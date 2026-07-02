import { LotteryDrawType, LotteryStatus, prisma } from "@connectiq/database";
import { ErrorCode } from "@connectiq/types";
import { ApiError } from "@/lib/api-auth";
import {
  buildEnterLotteryMobileResponse,
  drawBoothInstantLottery,
  type BoothLotteryLeadInput,
} from "@/lib/interaction/lottery-service";
import { ensureParticipantForUser } from "@/lib/interaction/participant-user";
import type { LotteryPrizeConfig } from "@/lib/interaction/schemas";
import type { LeadFormField } from "@/lib/lead-form/types";
import { normalizeLeadFormConfig } from "@/lib/lead-form/normalize";

function mapDrawType(raw: LotteryDrawType): "INSTANT" | "SCHEDULED" | "MANUAL" {
  if (raw === LotteryDrawType.SCHEDULED) return "SCHEDULED";
  if (raw === LotteryDrawType.MANUAL) return "MANUAL";
  return "INSTANT";
}

function mapLegacyPrizes(prizes: unknown) {
  if (!Array.isArray(prizes)) return [];
  return (prizes as LotteryPrizeConfig[])
    .slice()
    .sort((a, b) => a.rank - b.rank)
    .map((p) => ({
      rank: p.rank,
      name: p.name,
      prize: p.prize ?? p.name,
      quantity: p.count ?? 1,
      image_url: p.image_url ?? null,
    }));
}

export async function getLotteryAttendeeDetail(lotteryId: string, userId?: string | null) {
  const lottery = await prisma.lottery.findUnique({
    where: { id: lotteryId },
    include: {
      booth: {
        select: {
          id: true,
          code: true,
          name: true,
          companyOrg: { select: { name: true, logoUrl: true } },
        },
      },
      prizeItems: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!lottery) {
    throw new ApiError("抽奖不存在", ErrorCode.NOT_FOUND, 404);
  }

  const legacyPrizes = mapLegacyPrizes(lottery.prizes);
  const prizes =
    lottery.prizeItems.length > 0
      ? lottery.prizeItems.map((item, index) => ({
          id: item.id,
          rank: index + 1,
          name: item.name,
          prize: item.name,
          quantity: item.quantity,
          image_url: item.imageUrl,
        }))
      : legacyPrizes;

  const topPrize = prizes[0];
  let hasEntered = false;
  let won = false;
  let prizeName = topPrize?.prize ?? topPrize?.name ?? null;
  let prizeTier = topPrize?.rank ? `${topPrize.rank}等奖` : "特等奖";

  if (userId) {
    const entry = await prisma.lotteryEntry.findUnique({
      where: { lotteryId_userId: { lotteryId, userId } },
    });
    hasEntered = Boolean(entry);

    const winner = await prisma.lotteryWinner.findFirst({
      where: { lotteryId, userId },
      orderBy: { drawnAt: "desc" },
    });
    if (winner) {
      won = true;
      prizeName = winner.prizeName;
      prizeTier = `${winner.prizeRank}等奖`;
    }
  }

  return {
    id: lottery.id,
    event_id: lottery.eventId,
    title: lottery.title,
    description: lottery.description,
    status: lottery.status,
    draw_type: mapDrawType(lottery.drawType),
    draw_at: lottery.drawAt?.toISOString() ?? lottery.drawnAt?.toISOString() ?? null,
    booth_id: lottery.boothId,
    prize_tier: prizeTier,
    prize_name: prizeName ?? "精美礼品",
    prize_image_url: lottery.coverImage ?? topPrize?.image_url ?? null,
    participant_count: lottery.entryCount,
    has_entered: hasEntered,
    won,
    prizes,
    booth: lottery.booth
      ? {
          id: lottery.booth.id,
          booth_code: lottery.booth.code,
          company_name: lottery.booth.companyOrg.name,
          logo_url: lottery.booth.companyOrg.logoUrl ?? undefined,
          tagline: lottery.booth.name,
        }
      : null,
    lead_form_config: normalizeLeadFormConfig(lottery.leadFormConfig).fields,
    enter_points: 20,
    pickup_note: lottery.booth
      ? `请至 ${lottery.booth.name}（${lottery.booth.code}）服务台领取`
      : "请在活动结束前到主持台领取",
  };
}

export async function getLotteryMyEntry(lotteryId: string, userId: string) {
  const lottery = await prisma.lottery.findUnique({
    where: { id: lotteryId },
    select: { id: true, status: true, drawType: true, drawAt: true },
  });
  if (!lottery) {
    throw new ApiError("抽奖不存在", ErrorCode.NOT_FOUND, 404);
  }

  const entry = await prisma.lotteryEntry.findUnique({
    where: { lotteryId_userId: { lotteryId, userId } },
  });
  if (!entry) {
    return { has_entered: false };
  }

  const winner = await prisma.lotteryWinner.findFirst({
    where: { lotteryId, userId },
    orderBy: { drawnAt: "desc" },
  });

  const pendingDraw =
    !winner &&
    (lottery.status === LotteryStatus.OPEN || lottery.status === LotteryStatus.DRAWING);

  return {
    has_entered: true,
    entered_at: entry.enteredAt.toISOString(),
    pending_draw: pendingDraw,
    won: Boolean(winner),
    prize_name: winner?.prizeName ?? null,
    prize_tier: winner ? `${winner.prizeRank}等奖` : null,
    pickup_note: winner
      ? "请凭中奖通知至展位服务台领取"
      : undefined,
    draw_type: mapDrawType(lottery.drawType),
    draw_at: lottery.drawAt?.toISOString() ?? null,
  };
}

export type LeadFormSubmitInput = {
  lottery_id: string;
  event_id: string;
  booth_id?: string;
  name: string;
  phone: string;
  company?: string;
  title?: string;
  form_data?: Record<string, string>;
};

async function captureLeadForLottery(
  eventId: string,
  boothId: string,
  userId: string,
  lead: BoothLotteryLeadInput,
  formData?: Record<string, string>,
) {
  const participant = await ensureParticipantForUser(eventId, userId);
  if (!participant) return;

  const notes = JSON.stringify({
    source: "booth_lottery",
    ...lead,
    ...formData,
  });
  const existing = await prisma.lead.findFirst({
    where: { boothId, participantId: participant.id },
  });
  if (!existing) {
    await prisma.lead.create({
      data: { boothId, participantId: participant.id, notes },
    });
    return;
  }
  if (existing.notes !== notes) {
    await prisma.lead.update({
      where: { id: existing.id },
      data: { notes },
    });
  }
}

export async function submitLeadFormForLottery(userId: string, input: LeadFormSubmitInput) {
  const lottery = await prisma.lottery.findFirst({
    where: { id: input.lottery_id, eventId: input.event_id },
    include: {
      booth: { select: { id: true, name: true, code: true } },
    },
  });
  if (!lottery) {
    throw new ApiError("抽奖不存在", ErrorCode.NOT_FOUND, 404);
  }

  const boothId = input.booth_id ?? lottery.boothId ?? undefined;
  const lead: BoothLotteryLeadInput = {
    name: input.name,
    phone: input.phone,
    company: input.company,
    title: input.title,
  };

  const drawType = mapDrawType(lottery.drawType);

  if (drawType === "INSTANT" && boothId) {
    const instant = await drawBoothInstantLottery(boothId, userId, lead);
    return {
      lottery_id: instant.lottery_id ?? lottery.id,
      has_entered: true,
      won: instant.won,
      prize_tier: instant.prize_tier != null ? `${instant.prize_tier}等奖` : undefined,
      prize_name: instant.prize_name ?? undefined,
      pickup_note: instant.pickup_note,
      draw_type: "INSTANT" as const,
      enter_points: 20,
    };
  }

  if (boothId) {
    await captureLeadForLottery(input.event_id, boothId, userId, lead, input.form_data);
  }

  const entered = await buildEnterLotteryMobileResponse(
    input.event_id,
    lottery.id,
    userId,
  );

  return {
    lottery_id: lottery.id,
    has_entered: entered.has_entered,
    won: entered.won,
    prize_name: entered.prize_name ?? undefined,
    pending_draw: entered.pending_draw,
    draw_type: drawType,
    enter_points: 20,
    pickup_note: lottery.booth
      ? `请至 ${lottery.booth.name}（${lottery.booth.code}）服务台领取`
      : "请在活动结束前到主持台领取",
  };
}
