import {
  AnimationType as PrismaAnimationType,
  LotteryCategory,
  LotteryDrawType,
  LotteryOwnerType,
  LotteryStatus,
  LotteryType,
  PrizeType,
  TriggerAction as PrismaTriggerAction,
  prisma,
} from "@connectiq/database";
import { ErrorCode } from "@connectiq/types";
import { ApiError, type AuthSession } from "@/lib/api-auth";
import { createInteractionSession } from "@/lib/interaction/session-service";
import { getInteractionScanUrl } from "@/lib/qrcode";
import type { CreateBoothProbabilityLotteryInput } from "@/lib/lottery/booth-probability-lottery-schemas";
import { attachToRedemptionCode } from "@/lib/lottery/redemption";
import {
  drawWithProbability,
  ProbabilitySoldOutError,
} from "@/lib/lottery/probability-engine";
import { isLotteryOpenForEntry } from "@/lib/lottery/booth-lottery-service";
import {
  hasUserPollParticipation,
} from "@/lib/interaction/participant-user";

function mapPrizeType(raw: string) {
  if (raw === "DIGITAL") return PrizeType.DIGITAL;
  if (raw === "EXPERIENCE") return PrizeType.EXPERIENCE;
  return PrizeType.PHYSICAL;
}

function mapAnimationType(raw: CreateBoothProbabilityLotteryInput["animation_type"]) {
  return raw as PrismaAnimationType;
}

function mapTriggerAction(raw: CreateBoothProbabilityLotteryInput["trigger_action"]) {
  return raw as PrismaTriggerAction;
}

export async function createBoothProbabilityLottery(
  boothId: string,
  session: AuthSession,
  input: CreateBoothProbabilityLotteryInput,
) {
  const booth = await prisma.exhibitorBooth.findUnique({
    where: { id: boothId },
    select: {
      id: true,
      eventId: true,
      code: true,
      name: true,
      companyOrgId: true,
    },
  });
  if (!booth) {
    throw new ApiError("展位不存在", ErrorCode.NOT_FOUND, 404);
  }

  if (input.trigger_action === "SURVEY" && input.require_poll_id) {
    const poll = await prisma.poll.findFirst({
      where: { id: input.require_poll_id, eventId: booth.eventId },
      select: { id: true },
    });
    if (!poll) {
      throw new ApiError("关联问卷不存在", ErrorCode.VALIDATION_ERROR, 400);
    }
  }

  const legacyPrizes = input.prizes.map((prize, index) => ({
    rank: index + 1,
    name: prize.name,
    prize: prize.name,
    count: prize.quantity,
    image_url: prize.image_url,
    probability: prize.probability,
  }));

  const prizeTotal = input.prizes.reduce((sum, p) => sum + p.quantity, 0);
  const status = input.publish ? LotteryStatus.ACTIVE : LotteryStatus.DRAFT;
  const requireLeadCapture = input.trigger_action === "FILL_FORM";
  const requirePollId =
    input.trigger_action === "SURVEY" ? input.require_poll_id ?? null : null;

  const lottery = await prisma.$transaction(async (tx) => {
    const created = await tx.lottery.create({
      data: {
        eventId: booth.eventId,
        createdById: session.user.id,
        ownerType: LotteryOwnerType.EXHIBITOR,
        boothId: booth.id,
        title: input.title.trim(),
        description: input.description?.trim() || null,
        coverImage: input.prizes[0]?.image_url ?? null,
        drawType: LotteryDrawType.INSTANT,
        status,
        lotteryCategory: LotteryCategory.AUTO_PROBABILITY,
        animationType: mapAnimationType(input.animation_type),
        triggerAction: mapTriggerAction(input.trigger_action),
        type: LotteryType.RANDOM,
        prizes: legacyPrizes,
        winnerCount: Math.max(prizeTotal, 1),
        requireLeadCapture,
        requirePollId,
        leadFormConfig: [],
        maxEntriesPerUser: 1,
        allowReenter: false,
      },
    });

    for (const [index, prize] of input.prizes.entries()) {
      await tx.lotteryPrize.create({
        data: {
          lotteryId: created.id,
          name: prize.name.trim(),
          imageUrl: prize.image_url ?? null,
          quantity: prize.quantity,
          remaining: prize.quantity,
          probability: prize.probability,
          prizeType: mapPrizeType(prize.prize_type),
          sortOrder: index,
        },
      });
    }

    return created;
  });

  let interaction = null;
  if (input.publish) {
    const interactionSession = await createInteractionSession({
      eventId: booth.eventId,
      createdById: session.user.id,
      name: input.title,
      interactions: [{ type: "lottery", id: lottery.id }],
      boothId: booth.id,
      exhibitorOrgId: booth.companyOrgId,
      ownerType: "EXHIBITOR",
      settings: {
        requireLeadCapture,
        lotteryCategory: LotteryCategory.AUTO_PROBABILITY,
        animationType: input.animation_type,
      },
    });

    interaction = {
      session_id: interactionSession.id,
      session_code: interactionSession.sessionCode,
      qr_url: interactionSession.qrUrl,
      scan_url: getInteractionScanUrl(interactionSession.sessionCode),
    };
  }

  return {
    lottery: {
      id: lottery.id,
      title: lottery.title,
      status: lottery.status,
      lottery_category: LotteryCategory.AUTO_PROBABILITY,
      animation_type: input.animation_type,
      trigger_action: input.trigger_action,
    },
    interaction,
  };
}

async function assertProbabilityTriggerMet(
  lottery: {
    id: string;
    eventId: string;
    triggerAction: PrismaTriggerAction | null;
    requirePollId: string | null;
    requireLeadCapture: boolean;
  },
  userId: string,
) {
  if (lottery.triggerAction === PrismaTriggerAction.SCAN_ONLY) {
    return;
  }

  if (lottery.triggerAction === PrismaTriggerAction.FILL_FORM) {
    const entry = await prisma.lotteryEntry.findUnique({
      where: { lotteryId_userId: { lotteryId: lottery.id, userId } },
    });
    if (!entry) {
      throw new ApiError("请先填写表单后再抽奖", ErrorCode.FORBIDDEN, 403);
    }
    return;
  }

  if (lottery.triggerAction === PrismaTriggerAction.SURVEY) {
    if (!lottery.requirePollId) {
      throw new ApiError("抽奖未关联问卷", ErrorCode.VALIDATION_ERROR, 400);
    }
    const participated = await hasUserPollParticipation(
      lottery.eventId,
      userId,
      lottery.requirePollId,
    );
    if (!participated) {
      throw new ApiError("请先完成问卷后再抽奖", ErrorCode.FORBIDDEN, 403);
    }
  }
}

export type ProbabilityDrawResult = {
  won: boolean;
  prize_id: string | null;
  prize_name: string | null;
  prize_image: string | null;
  animation_type: string | null;
  winner_id: string | null;
  redemption_code: string | null;
  message: string;
};

export async function executeProbabilityLotteryDraw(
  lotteryId: string,
  userId: string,
): Promise<ProbabilityDrawResult> {
  const lottery = await prisma.lottery.findUnique({
    where: { id: lotteryId },
    include: {
      prizeItems: { orderBy: { sortOrder: "asc" } },
    },
  });

  if (!lottery) {
    throw new ApiError("抽奖不存在", ErrorCode.NOT_FOUND, 404);
  }

  if (lottery.lotteryCategory !== LotteryCategory.AUTO_PROBABILITY) {
    throw new ApiError("非概率抽奖", ErrorCode.VALIDATION_ERROR, 400);
  }

  if (!isLotteryOpenForEntry(lottery.status)) {
    throw new ApiError("抽奖未开放", ErrorCode.VALIDATION_ERROR, 400);
  }

  const existingWinner = await prisma.lotteryWinner.findFirst({
    where: { lotteryId, userId },
  });
  if (existingWinner) {
    throw new ApiError("您已参与过本次抽奖", ErrorCode.VALIDATION_ERROR, 409);
  }

  await assertProbabilityTriggerMet(lottery, userId);

  if (lottery.triggerAction === PrismaTriggerAction.SCAN_ONLY) {
    await prisma.lotteryEntry.upsert({
      where: { lotteryId_userId: { lotteryId, userId } },
      create: { lotteryId, userId },
      update: {},
    });
  }

  const maxAttempts = 5;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const result = await prisma.$transaction(async (tx) => {
        const prizes = await tx.lotteryPrize.findMany({
          where: { lotteryId },
          orderBy: { sortOrder: "asc" },
        });

        const pickedId = drawWithProbability(
          prizes.map((p) => ({
            id: p.id,
            probability: p.probability ?? 0,
            remaining: p.remaining,
          })),
        );

        if (!pickedId) {
          return {
            won: false as const,
            prize: null,
            winnerId: null as string | null,
            code: null as string | null,
          };
        }

        const decrement = await tx.lotteryPrize.updateMany({
          where: { id: pickedId, remaining: { gt: 0 } },
          data: { remaining: { decrement: 1 } },
        });

        if (decrement.count === 0) {
          throw new ProbabilitySoldOutError();
        }

        const prize = prizes.find((p) => p.id === pickedId)!;
        const winner = await tx.lotteryWinner.create({
          data: {
            lotteryId,
            userId,
            prizeId: prize.id,
            prizeRank: prize.sortOrder + 1,
            prizeName: prize.name,
          },
        });

        const redemption = await attachToRedemptionCode(
          userId,
          lottery.eventId,
          winner.id,
          tx,
        );

        return {
          won: true as const,
          prize,
          winnerId: winner.id,
          code: redemption.code,
        };
      });

      if (!result.won) {
        return {
          won: false,
          prize_id: null,
          prize_name: null,
          prize_image: null,
          animation_type: lottery.animationType,
          winner_id: null,
          redemption_code: null,
          message: "谢谢参与，欢迎下次再来",
        };
      }

      return {
        won: true,
        prize_id: result.prize.id,
        prize_name: result.prize.name,
        prize_image: result.prize.imageUrl,
        animation_type: lottery.animationType,
        winner_id: result.winnerId,
        redemption_code: result.code,
        message: `恭喜获得 ${result.prize.name}`,
      };
    } catch (err) {
      if (err instanceof ProbabilitySoldOutError && attempt < maxAttempts - 1) {
        continue;
      }
      if (err instanceof ProbabilitySoldOutError) {
        return {
          won: false,
          prize_id: null,
          prize_name: null,
          prize_image: null,
          animation_type: lottery.animationType,
          winner_id: null,
          redemption_code: null,
          message: "奖品已发完，谢谢参与",
        };
      }
      throw err;
    }
  }

  return {
    won: false,
    prize_id: null,
    prize_name: null,
    prize_image: null,
    animation_type: lottery.animationType,
    winner_id: null,
    redemption_code: null,
    message: "谢谢参与",
  };
}
