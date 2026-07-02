import {
  LotteryDrawType,
  LotteryOwnerType,
  LotteryStatus,
  LotteryType,
  PrizeType,
  prisma,
} from "@connectiq/database";
import { ErrorCode } from "@connectiq/types";
import { ApiError, type AuthSession } from "@/lib/api-auth";
import { createInteractionSession } from "@/lib/interaction/session-service";
import { getInteractionScanUrl } from "@/lib/qrcode";
import {
  normalizeLeadFormConfig,
  serializeLeadFormConfig,
} from "@/lib/lead-form/normalize";
import type { CreateBoothLotteryInput } from "./booth-lottery-schemas";

function mapLegacyPrizes(prizes: CreateBoothLotteryInput["prizes"]) {
  return prizes.map((prize, index) => ({
    rank: index + 1,
    name: prize.name,
    prize: prize.name,
    count: prize.quantity,
    image_url: prize.image_url,
  }));
}

function mapPrizeType(raw: CreateBoothLotteryInput["prizes"][number]["prize_type"]) {
  if (raw === "DIGITAL") return PrizeType.DIGITAL;
  if (raw === "EXPERIENCE") return PrizeType.EXPERIENCE;
  return PrizeType.PHYSICAL;
}

export async function listBoothLotteries(boothId: string) {
  const lotteries = await prisma.lottery.findMany({
    where: { boothId },
    orderBy: { createdAt: "desc" },
    include: {
      prizeItems: { orderBy: { sortOrder: "asc" } },
      _count: { select: { entries: true, winners: true } },
    },
  });

  return lotteries.map((lottery) => ({
    id: lottery.id,
    title: lottery.title,
    description: lottery.description,
    status: lottery.status,
    draw_type: lottery.drawType,
    draw_at: lottery.drawAt?.toISOString() ?? null,
    require_lead_capture: lottery.requireLeadCapture,
    max_entries_per_user: lottery.maxEntriesPerUser,
    allow_reenter: lottery.allowReenter,
    entry_count: lottery._count.entries,
    winner_count: lottery._count.winners,
    cover_image: lottery.coverImage,
    prizes:
      lottery.prizeItems.length > 0
        ? lottery.prizeItems.map((item) => ({
            id: item.id,
            name: item.name,
            image_url: item.imageUrl,
            quantity: item.quantity,
            remaining: item.remaining,
            prize_type: item.prizeType,
          }))
        : mapLegacyPrizes(
            (Array.isArray(lottery.prizes)
              ? (lottery.prizes as Array<{
                  name?: string;
                  prize?: string;
                  count?: number;
                  image_url?: string;
                }>)
              : []
            ).map((p) => ({
              name: p.name ?? p.prize ?? "奖品",
              quantity: p.count ?? 1,
              image_url: p.image_url,
              prize_type: "PHYSICAL" as const,
            })),
          ),
    created_at: lottery.createdAt.toISOString(),
  }));
}

export async function createBoothLottery(
  boothId: string,
  session: AuthSession,
  input: CreateBoothLotteryInput,
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

  if (input.draw_type === LotteryDrawType.SCHEDULED && !input.draw_at) {
    throw new ApiError("定时开奖需设置开奖时间", ErrorCode.VALIDATION_ERROR, 400);
  }

  const legacyPrizes = mapLegacyPrizes(input.prizes);
  const prizeTotal = input.prizes.reduce((sum, p) => sum + p.quantity, 0);
  const winnerCount = Math.max(prizeTotal, 1);
  const leadFormConfig = serializeLeadFormConfig(
    normalizeLeadFormConfig(input.lead_form_config ?? { fields: [] }),
  );
  const status = input.publish ? LotteryStatus.ACTIVE : LotteryStatus.DRAFT;

  const lottery = await prisma.$transaction(async (tx) => {
    const created = await tx.lottery.create({
      data: {
        eventId: booth.eventId,
        createdById: session.user.id,
        ownerType: LotteryOwnerType.EXHIBITOR,
        boothId: booth.id,
        title: input.title,
        description: input.description,
        coverImage: input.prizes[0]?.image_url ?? null,
        drawType: input.draw_type,
        drawAt: input.draw_at ? new Date(input.draw_at) : null,
        status,
        type: LotteryType.RANDOM,
        prizes: legacyPrizes,
        winnerCount,
        requireLeadCapture: input.require_lead_capture,
        leadFormConfig,
        maxEntriesPerUser: input.unlimited_entries ? 9999 : 1,
        allowReenter: input.unlimited_entries,
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
      settings: { requireLeadCapture: input.require_lead_capture },
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
      draw_type: lottery.drawType,
      draw_at: lottery.drawAt?.toISOString() ?? null,
      require_lead_capture: lottery.requireLeadCapture,
    },
    interaction,
  };
}

/** 抽奖是否开放参与（兼容 ACTIVE 与旧版 OPEN） */
export function isLotteryOpenForEntry(status: LotteryStatus): boolean {
  return status === LotteryStatus.OPEN || status === LotteryStatus.ACTIVE;
}
