import {
  ConnectionStatus,
  LotteryCategory,
  LotteryOwnerType,
  LotteryStatus,
  StampOwnerType,
  StampRallyStatus,
  prisma,
} from "@connectiq/database";
import { ErrorCode } from "@connectiq/types";
import { ApiError } from "@/lib/api-auth";
import { enterLottery } from "@/lib/interaction/lottery-service";
import {
  findParticipantForUser,
  hasUserCheckedIn,
} from "@/lib/interaction/participant-user";
import { isEventFeatureEnabled } from "@/lib/event-feature-flags-server";
import {
  loadOrganizerLotteryMeta,
  syncOrganizerLotteryEntriesFromEligibility,
} from "@/lib/lottery/organizer-lottery-service";
import {
  tierLabel,
  type OrganizerLotteryEligibility,
} from "@/lib/lottery/organizer-lottery-config";
import { buildTierStates } from "@/lib/lottery/lottery-screen-service";

export type PoolLotteryConditionRow = {
  id: string;
  label: string;
  met: boolean;
  progress_text: string | null;
};

export type PoolLotteryPrizePreview = {
  id: string;
  tier: number;
  tier_label: string;
  medal: string;
  name: string;
  quantity: number;
  image_url: string | null;
};

export type PoolLotteryTierProgress = {
  tier: number;
  label: string;
  prize_name: string;
  quantity: number;
  drawn_count: number;
  complete: boolean;
  is_active: boolean;
};

export type PoolLotteryMyWin = {
  winner_id: string;
  prize_name: string;
  prize_rank: number;
  tier_label: string;
  verified: boolean;
  won_at: string;
};

export type PoolLotteryMobileView = {
  lottery_id: string;
  event_id: string;
  event_name: string;
  title: string;
  status: string;
  draw_at: string | null;
  draw_label: string;
  entry_count: number;
  has_entered: boolean;
  all_conditions_met: boolean;
  conditions: PoolLotteryConditionRow[];
  prizes: PoolLotteryPrizePreview[];
  active_tier: number | null;
  tiers: PoolLotteryTierProgress[];
  my_wins: PoolLotteryMyWin[];
};

function tierMedal(tier: number): string {
  if (tier === 1) return "🥇";
  if (tier === 2) return "🥈";
  if (tier === 3) return "🥉";
  return "🎁";
}

function formatDrawTime(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

async function countUserPollInteractions(
  eventId: string,
  userId: string,
): Promise<number> {
  const participant = await findParticipantForUser(eventId, userId);
  if (!participant) return 0;

  const pollIds = await prisma.poll.findMany({
    where: { eventId },
    select: { id: true },
  });
  if (pollIds.length === 0) return 0;

  const responses = await prisma.pollResponse.groupBy({
    by: ["pollId"],
    where: {
      pollId: { in: pollIds.map((p) => p.id) },
      participantId: participant.id,
    },
    _count: { pollId: true },
  });

  return responses.length;
}

async function countUserConnections(eventId: string, userId: string): Promise<number> {
  const rows = await prisma.businessConnection.findMany({
    where: {
      eventId,
      status: ConnectionStatus.ACTIVE,
      OR: [{ userAId: userId }, { userBId: userId }],
    },
    select: { id: true },
  });
  return rows.length;
}

async function resolveStampProgress(
  eventId: string,
  userId: string,
  rallyId: string | null,
): Promise<{ stamped: number; required: number; completed: boolean }> {
  let resolvedRallyId = rallyId;
  if (!resolvedRallyId) {
    const rally = await prisma.stampRally.findFirst({
      where: {
        eventId,
        ownerType: StampOwnerType.ORGANIZER,
        status: StampRallyStatus.ACTIVE,
      },
      orderBy: { createdAt: "desc" },
      select: { id: true, requiredCount: true },
    });
    if (!rally) return { stamped: 0, required: 0, completed: false };
    resolvedRallyId = rally.id;
  }

  const rally = await prisma.stampRally.findUnique({
    where: { id: resolvedRallyId },
    select: { requiredCount: true },
  });
  if (!rally) return { stamped: 0, required: 0, completed: false };

  const progress = await prisma.userStampProgress.findUnique({
    where: { userId_rallyId: { userId, rallyId: resolvedRallyId } },
    select: { collectedCount: true, isCompleted: true },
  });

  const stamped = progress?.collectedCount ?? 0;
  const required = rally.requiredCount;
  return {
    stamped,
    required,
    completed: Boolean(progress?.isCompleted) || stamped >= required,
  };
}

async function buildConditionsForUser(
  eventId: string,
  userId: string,
  criteria: OrganizerLotteryEligibility,
): Promise<PoolLotteryConditionRow[]> {
  const rows: PoolLotteryConditionRow[] = [];

  if (criteria.require_checkin) {
    const met = await hasUserCheckedIn(eventId, userId);
    rows.push({
      id: "checkin",
      label: met ? "已签到" : "未完成签到",
      met,
      progress_text: null,
    });
  }

  if (criteria.min_interactions && criteria.min_interactions > 0) {
    const count = await countUserPollInteractions(eventId, userId);
    const required = criteria.min_interactions;
    const met = count >= required;
    rows.push({
      id: "interactions",
      label: met
        ? `已参与 ${count} 个互动`
        : `已参与 ${count}/${required} 个互动`,
      met,
      progress_text: met ? null : `还差 ${required - count} 个`,
    });
  }

  if (criteria.require_stamp_rally) {
    const stamp = await resolveStampProgress(
      eventId,
      userId,
      criteria.stamp_rally_id,
    );
    const met = stamp.completed;
    const remaining = Math.max(stamp.required - stamp.stamped, 0);
    rows.push({
      id: "stamp_rally",
      label: met
        ? "已集满全场集章"
        : `集满全场集章（${stamp.stamped}/${stamp.required}${remaining > 0 ? `，还差${remaining}个` : ""}）`,
      met,
      progress_text: met ? null : remaining > 0 ? `还差 ${remaining} 个` : null,
    });
  }

  if (criteria.min_connections && criteria.min_connections > 0) {
    const count = await countUserConnections(eventId, userId);
    const required = criteria.min_connections;
    const met = count >= required;
    rows.push({
      id: "connections",
      label: met
        ? `已建立 ${count} 个有效连接`
        : `建立有效连接（${count}/${required}）`,
      met,
      progress_text: met ? null : `还差 ${required - count} 个`,
    });
  }

  return rows;
}

function buildConditionTemplates(
  criteria: OrganizerLotteryEligibility,
): PoolLotteryConditionRow[] {
  const rows: PoolLotteryConditionRow[] = [];

  if (criteria.require_checkin) {
    rows.push({
      id: "checkin",
      label: "未完成签到",
      met: false,
      progress_text: null,
    });
  }

  if (criteria.min_interactions && criteria.min_interactions > 0) {
    rows.push({
      id: "interactions",
      label: `已参与 0/${criteria.min_interactions} 个互动`,
      met: false,
      progress_text: `还差 ${criteria.min_interactions} 个`,
    });
  }

  if (criteria.require_stamp_rally) {
    rows.push({
      id: "stamp_rally",
      label: "集满全场集章",
      met: false,
      progress_text: null,
    });
  }

  if (criteria.min_connections && criteria.min_connections > 0) {
    rows.push({
      id: "connections",
      label: `建立有效连接（0/${criteria.min_connections}）`,
      met: false,
      progress_text: `还差 ${criteria.min_connections} 个`,
    });
  }

  return rows;
}

async function findPoolLottery(eventId: string, lotteryId?: string) {
  return prisma.lottery.findFirst({
    where: {
      eventId,
      ownerType: LotteryOwnerType.ORGANIZER,
      boothId: null,
      ...(lotteryId ? { id: lotteryId } : {}),
      lotteryCategory: LotteryCategory.POOL_DRAW,
      status: {
        in: [
          LotteryStatus.OPEN,
          LotteryStatus.DRAWING,
          LotteryStatus.FINISHED,
          LotteryStatus.ACTIVE,
        ],
      },
    },
    include: {
      event: { select: { name: true } },
      prizeItems: { orderBy: { sortOrder: "asc" } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getPoolLotteryMobileView(
  eventId: string,
  userId: string | null,
  lotteryIdHint?: string,
): Promise<PoolLotteryMobileView | null> {
  const enabled = await isEventFeatureEnabled(eventId, "lottery");
  if (!enabled) return null;

  const lottery = await findPoolLottery(eventId, lotteryIdHint);
  if (!lottery) return null;

  const meta = await loadOrganizerLotteryMeta(eventId, lottery.id);

  if (
    lottery.status === LotteryStatus.OPEN ||
    lottery.status === LotteryStatus.DRAWING
  ) {
    await syncOrganizerLotteryEntriesFromEligibility(eventId, lottery.id);
  }

  const entryCount = await prisma.lotteryEntry.count({
    where: { lotteryId: lottery.id },
  });

  let hasEntered = false;
  let conditions: PoolLotteryConditionRow[] = [];
  if (userId) {
    const entry = await prisma.lotteryEntry.findUnique({
      where: { lotteryId_userId: { lotteryId: lottery.id, userId } },
    });
    hasEntered = Boolean(entry);
    conditions = await buildConditionsForUser(eventId, userId, meta.eligibility);
  } else {
    conditions = buildConditionTemplates(meta.eligibility);
  }

  const allConditionsMet =
    conditions.length === 0 || conditions.every((row) => row.met);

  const drawAt = lottery.drawAt;
  const drawLabel = drawAt
    ? `闭幕仪式 · ${formatDrawTime(drawAt)}`
    : "请关注现场大屏";

  const prizes: PoolLotteryPrizePreview[] = lottery.prizeItems.map((item) => {
    const tier = item.tier ?? item.sortOrder + 1;
    return {
      id: item.id,
      tier,
      tier_label: tierLabel(tier),
      medal: tierMedal(tier),
      name: item.name,
      quantity: item.quantity,
      image_url: item.imageUrl,
    };
  });

  const winners = await prisma.lotteryWinner.findMany({
    where: { lotteryId: lottery.id },
    select: { prizeId: true, prizeRank: true, userId: true },
  });

  const tierStates = buildTierStates(
    lottery.prizeItems.map((p) => ({
      id: p.id,
      name: p.name,
      quantity: p.quantity,
      sortOrder: p.sortOrder,
      tier: p.tier,
    })),
    winners.map((w) => ({ prizeId: w.prizeId, prizeRank: w.prizeRank })),
    meta.prize_draw_order,
    meta.active_draw_tier,
  );

  const myWinRows = userId
    ? await prisma.lotteryWinner.findMany({
        where: { lotteryId: lottery.id, userId },
        orderBy: { wonAt: "desc" },
      })
    : [];

  return {
    lottery_id: lottery.id,
    event_id: eventId,
    event_name: lottery.event.name,
    title: lottery.title,
    status: lottery.status,
    draw_at: drawAt?.toISOString() ?? null,
    draw_label: drawLabel,
    entry_count: entryCount,
    has_entered: hasEntered,
    all_conditions_met: allConditionsMet,
    conditions,
    prizes,
    active_tier: meta.active_draw_tier,
    tiers: tierStates.map((t) => ({
      tier: t.tier,
      label: t.label,
      prize_name: t.prize_name,
      quantity: t.quantity,
      drawn_count: t.drawn_count,
      complete: t.complete,
      is_active: t.is_active,
    })),
    my_wins: myWinRows.map((w) => ({
      winner_id: w.id,
      prize_name: w.prizeName,
      prize_rank: w.prizeRank,
      tier_label: tierLabel(w.prizeRank),
      verified: w.verified,
      won_at: w.wonAt.toISOString(),
    })),
  };
}

export async function enterPoolLotteryMobile(
  eventId: string,
  userId: string,
  lotteryIdHint?: string,
): Promise<PoolLotteryMobileView> {
  const view = await getPoolLotteryMobileView(eventId, userId, lotteryIdHint);
  if (!view) {
    throw new ApiError("闭幕大抽奖不存在或已结束", ErrorCode.NOT_FOUND, 404);
  }

  if (view.has_entered) return view;

  if (!view.all_conditions_met) {
    throw new ApiError("还需完成参与条件", ErrorCode.FORBIDDEN, 403);
  }

  try {
    await enterLottery(eventId, view.lottery_id, userId);
  } catch (err) {
    if (!(err instanceof ApiError && err.message === "您已参与过该抽奖")) {
      throw err;
    }
  }

  const refreshed = await getPoolLotteryMobileView(eventId, userId, view.lottery_id);
  if (!refreshed) {
    throw new ApiError("抽奖状态异常", ErrorCode.INTERNAL_ERROR, 500);
  }
  return refreshed;
}
