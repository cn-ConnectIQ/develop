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
import type { CreateBoothLotteryInput } from "@/lib/lottery/booth-lottery-schemas";
import {
  normalizeLeadFormConfig,
  serializeLeadFormConfig,
} from "@/lib/lead-form/normalize";
import {
  QUICK_LAUNCH_CODE_03B,
  QUICK_LAUNCH_TEMPLATE_FILL_GET_GIFT,
} from "@/lib/lottery/quick-launch-templates";

function mapPrizeType(raw: string) {
  if (raw === "DIGITAL") return PrizeType.DIGITAL;
  if (raw === "EXPERIENCE") return PrizeType.EXPERIENCE;
  return PrizeType.PHYSICAL;
}

function mapLegacyPrizes(prizes: CreateBoothLotteryInput["prizes"]) {
  return prizes.map((prize, index) => ({
    rank: index + 1,
    name: prize.name,
    prize: prize.name,
    count: prize.quantity,
    image_url: prize.image_url,
  }));
}

/** 主办方 · 概率抽奖（AUTO_PROBABILITY） */
export async function createOrganizerProbabilityLottery(
  eventId: string,
  session: AuthSession,
  input: CreateBoothProbabilityLotteryInput,
) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true },
  });
  if (!event) {
    throw new ApiError("活动不存在", ErrorCode.NOT_FOUND, 404);
  }

  if (input.trigger_action === "SURVEY" && input.require_poll_id) {
    const poll = await prisma.poll.findFirst({
      where: { id: input.require_poll_id, eventId },
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
        eventId,
        createdById: session.user.id,
        ownerType: LotteryOwnerType.ORGANIZER,
        boothId: null,
        title: input.title.trim(),
        description: input.description?.trim() || null,
        coverImage: input.prizes[0]?.image_url ?? null,
        drawType: LotteryDrawType.INSTANT,
        status,
        lotteryCategory: LotteryCategory.AUTO_PROBABILITY,
        animationType: input.animation_type as PrismaAnimationType,
        triggerAction: input.trigger_action as PrismaTriggerAction,
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
      eventId,
      createdById: session.user.id,
      name: input.title,
      interactions: [{ type: "lottery", id: lottery.id }],
      ownerType: "ORGANIZER",
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

/** 主办方 · 直接领取（INSTANT_CLAIM） */
export async function createOrganizerInstantClaimLottery(
  eventId: string,
  session: AuthSession,
  input: CreateBoothLotteryInput,
) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true },
  });
  if (!event) {
    throw new ApiError("活动不存在", ErrorCode.NOT_FOUND, 404);
  }

  const legacyPrizes = mapLegacyPrizes(input.prizes);
  const prizeTotal = input.prizes.reduce((sum, prize) => sum + prize.quantity, 0);
  const winnerCount = Math.max(prizeTotal, 1);
  const leadFormConfig = serializeLeadFormConfig(
    normalizeLeadFormConfig(input.lead_form_config ?? { fields: [] }),
  );
  const status = input.publish ? LotteryStatus.ACTIVE : LotteryStatus.DRAFT;

  const lottery = await prisma.$transaction(async (tx) => {
    const created = await tx.lottery.create({
      data: {
        eventId,
        createdById: session.user.id,
        ownerType: LotteryOwnerType.ORGANIZER,
        boothId: null,
        title: input.title,
        description: input.description,
        coverImage: input.prizes[0]?.image_url ?? null,
        drawType: LotteryDrawType.INSTANT,
        status,
        type: LotteryType.RANDOM,
        lotteryCategory: LotteryCategory.INSTANT_CLAIM,
        triggerAction: PrismaTriggerAction.FILL_FORM,
        prizes: legacyPrizes,
        winnerCount,
        requireLeadCapture: true,
        leadFormConfig,
        maxEntriesPerUser: 1,
        allowReenter: false,
      },
    });

    for (const [index, prize] of input.prizes.entries()) {
      await tx.lotteryPrize.create({
        data: {
          lotteryId: created.id,
          name: prize.name,
          imageUrl: prize.image_url ?? null,
          quantity: prize.quantity,
          remaining: prize.quantity,
          prizeType: mapPrizeType(prize.prize_type),
          sortOrder: index,
          probability: 1,
        },
      });
    }

    return created;
  });

  let interaction = null;
  if (input.publish) {
    const interactionSession = await createInteractionSession({
      eventId,
      createdById: session.user.id,
      name: input.title,
      interactions: [{ type: "lottery", id: lottery.id }],
      ownerType: "ORGANIZER",
      settings: {
        quickLaunchTemplate: QUICK_LAUNCH_TEMPLATE_FILL_GET_GIFT,
        quickLaunchCode: QUICK_LAUNCH_CODE_03B,
        requireLeadCapture: true,
      },
    });

    interaction = {
      quick_launch_id: interactionSession.id,
      session_id: interactionSession.id,
      session_code: interactionSession.sessionCode,
      qr_url: interactionSession.qrUrl,
      scan_url: getInteractionScanUrl(interactionSession.sessionCode),
    };
  }

  return {
    template: QUICK_LAUNCH_TEMPLATE_FILL_GET_GIFT,
    template_code: QUICK_LAUNCH_CODE_03B,
    lottery: {
      id: lottery.id,
      title: lottery.title,
      status: lottery.status,
      lottery_category: lottery.lotteryCategory,
      trigger_action: lottery.triggerAction,
      require_lead_capture: lottery.requireLeadCapture,
    },
    interaction,
  };
}
