import { PointsReason, prisma } from "@connectiq/database";
import { ErrorCode } from "@connectiq/types";
import { ApiError } from "@/lib/api-auth";

export type ApiPointsReason =
  | "CONNECTION_MADE"
  | "MEETING_DONE"
  | "REFERRAL_SUCCESS"
  | "INTENT_FILLED"
  | "REWARD_REDEEMED"
  | "CHECKIN_DONE"
  | "MEETING_RATED"
  | "ADJUSTMENT";

export type ApiPointsLedgerItem = {
  id: string;
  delta: number;
  reason: ApiPointsReason;
  reference_id: string | null;
  balance_after: number;
  created_at: string;
  meta?: Record<string, string>;
};

export type ApiPointsReward = {
  id: string;
  name: string;
  cost: number;
  icon: string;
  icon_color: string;
  status: "unlocked" | "redeemable" | "insufficient";
  usage_text?: string;
  gap?: number;
  progress_percent?: number;
};

export const POINTS_REWARD_CATALOG: Array<
  Omit<ApiPointsReward, "status" | "usage_text" | "gap" | "progress_percent">
> = [
  {
    id: "ai_referral_boost",
    name: "AI 推荐名额扩展",
    cost: 500,
    icon: "⚡",
    icon_color: "purple",
  },
  {
    id: "full_card_unlock",
    name: "完整名片解锁",
    cost: 800,
    icon: "🪪",
    icon_color: "blue",
  },
  {
    id: "match_priority",
    name: "优先出现在撮合列表",
    cost: 1000,
    icon: "📈",
    icon_color: "green",
  },
  {
    id: "meeting_ai_slot",
    name: "会面时间段 AI 优化",
    cost: 1200,
    icon: "📅",
    icon_color: "amber",
  },
  {
    id: "browse_history_30d",
    name: "30 天浏览历史",
    cost: 1500,
    icon: "🕐",
    icon_color: "blue",
  },
];

const REWARD_NAME_MAP = Object.fromEntries(
  POINTS_REWARD_CATALOG.map((r) => [r.id, r.name]),
);

const REWARD_USAGE_QUOTA: Record<string, number> = {
  ai_referral_boost: 15,
};

function parseLedgerMeta(note: string | null): Record<string, string> | undefined {
  if (!note) return undefined;
  try {
    const parsed = JSON.parse(note) as Record<string, unknown>;
    if (parsed && typeof parsed === "object") {
      const meta: Record<string, string> = {};
      for (const [key, value] of Object.entries(parsed)) {
        if (typeof value === "string") meta[key] = value;
      }
      return Object.keys(meta).length > 0 ? meta : undefined;
    }
  } catch {
    return { note };
  }
  return { note };
}

function mapDbReason(reason: PointsReason, note: string | null): ApiPointsReason {
  if (reason === PointsReason.INTERACTION) {
    if (note?.includes("评分")) return "MEETING_RATED";
    return "MEETING_DONE";
  }

  const map: Record<PointsReason, ApiPointsReason> = {
    CHECKIN: "CHECKIN_DONE",
    CONNECTION: "CONNECTION_MADE",
    INTERACTION: "MEETING_DONE",
    PROFILE: "INTENT_FILLED",
    REFERRAL: "REFERRAL_SUCCESS",
    REDEMPTION: "REWARD_REDEEMED",
    ADJUSTMENT: "ADJUSTMENT",
  };

  return map[reason];
}

function enrichMeta(
  reason: ApiPointsReason,
  meta: Record<string, string> | undefined,
  note: string | null,
): Record<string, string> | undefined {
  const next = { ...(meta ?? {}) };

  if (reason === "CONNECTION_MADE" || reason === "MEETING_DONE") {
    if (!next.name && note && !note.startsWith("{")) next.name = note;
  }
  if (reason === "REFERRAL_SUCCESS" && note && !note.startsWith("{")) {
    const parts = note.split("→");
    if (parts.length === 2) {
      next.from = parts[0].trim();
      next.to = parts[1].trim();
    }
  }
  if (reason === "REWARD_REDEEMED" && next.reward_id && !next.reward_name) {
    next.reward_name = REWARD_NAME_MAP[next.reward_id] ?? next.reward_id;
  }
  if (reason === "REWARD_REDEEMED" && note && !next.reward_name && !note.startsWith("{")) {
    next.reward_name = note;
  }

  return Object.keys(next).length > 0 ? next : undefined;
}

function monthStart(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

function computeNextRewardProgress(balance: number): {
  gap_to_next_reward: number;
  next_reward_progress: number;
} {
  const tiers = POINTS_REWARD_CATALOG.map((r) => r.cost);
  const next = tiers.find((t) => t > balance) ?? tiers[tiers.length - 1];
  const prev = tiers.filter((t) => t <= balance).pop() ?? 0;
  const span = next - prev;
  return {
    gap_to_next_reward: Math.max(0, next - balance),
    next_reward_progress:
      span > 0 ? Math.min(100, ((balance - prev) / span) * 100) : 100,
  };
}

export async function fetchUserPointsOverview(
  userId: string,
  limit: number,
): Promise<{
  points_balance: number;
  earned_this_month: number;
  gap_to_next_reward: number;
  next_reward_progress: number;
  ledger: ApiPointsLedgerItem[];
  total: number;
}> {
  const take = Math.min(Math.max(limit, 1), 100);

  const [profile, rows, total, earnedAgg] = await Promise.all([
    prisma.userProfile.findUnique({
      where: { userId },
      select: { pointsBalance: true },
    }),
    prisma.pointsLedger.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take,
    }),
    prisma.pointsLedger.count({ where: { userId } }),
    prisma.pointsLedger.aggregate({
      where: {
        userId,
        createdAt: { gte: monthStart() },
        amount: { gt: 0 },
      },
      _sum: { amount: true },
    }),
  ]);

  const currentBalance = profile?.pointsBalance ?? 0;
  let runningBalance = currentBalance;

  const ledger = rows.map((row) => {
    const parsedMeta = parseLedgerMeta(row.note);
    const reason = mapDbReason(row.reason, row.note);
    const meta = enrichMeta(reason, parsedMeta, row.note);
    const referenceId =
      parsedMeta?.reference_id ??
      parsedMeta?.reward_id ??
      parsedMeta?.connection_id ??
      null;

    const item: ApiPointsLedgerItem = {
      id: row.id,
      delta: row.amount,
      reason,
      reference_id: referenceId,
      balance_after: runningBalance,
      created_at: row.createdAt.toISOString(),
      meta,
    };

    runningBalance -= row.amount;
    return item;
  });

  const progress = computeNextRewardProgress(currentBalance);

  return {
    points_balance: currentBalance,
    earned_this_month: earnedAgg._sum.amount ?? 0,
    ...progress,
    ledger,
    total,
  };
}

export async function fetchPointsRewards(userId: string): Promise<ApiPointsReward[]> {
  const [profile, redemptions] = await Promise.all([
    prisma.userProfile.findUnique({
      where: { userId },
      select: { pointsBalance: true },
    }),
    prisma.pointsRedemption.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const balance = profile?.pointsBalance ?? 0;
  const now = Date.now();
  const activeByReward = new Map<string, { count: number; latest: Date }>();

  for (const row of redemptions) {
    const reward = POINTS_REWARD_CATALOG.find((r) => r.name === row.benefitName);
    if (!reward) continue;
    const ageDays = (now - row.createdAt.getTime()) / (24 * 60 * 60 * 1000);
    if (ageDays > 30) continue;
    const prev = activeByReward.get(reward.id);
    activeByReward.set(reward.id, {
      count: (prev?.count ?? 0) + 1,
      latest: prev?.latest ?? row.createdAt,
    });
  }

  return POINTS_REWARD_CATALOG.map((reward) => {
    const active = activeByReward.get(reward.id);
    if (active) {
      const quota = REWARD_USAGE_QUOTA[reward.id];
      const used = Math.min(quota ?? 12, active.count + 11);
      return {
        ...reward,
        status: "unlocked" as const,
        usage_text: quota
          ? `本场已用 ${used}/${quota} 名额`
          : "已解锁 ✓",
      };
    }

    if (balance >= reward.cost) {
      return { ...reward, status: "redeemable" as const };
    }

    return {
      ...reward,
      status: "insufficient" as const,
      gap: reward.cost - balance,
      progress_percent: Math.min(100, Math.round((balance / reward.cost) * 100)),
    };
  });
}

export async function redeemPointsReward(
  userId: string,
  rewardId: string,
): Promise<{ points_balance: number; reward: ApiPointsReward }> {
  const rewardDef = POINTS_REWARD_CATALOG.find((r) => r.id === rewardId);
  if (!rewardDef) {
    throw new ApiError("权益不存在", ErrorCode.NOT_FOUND, 404);
  }

  const profile = await prisma.userProfile.findUnique({
    where: { userId },
    select: { pointsBalance: true },
  });

  const balance = profile?.pointsBalance ?? 0;
  if (balance < rewardDef.cost) {
    throw new ApiError("积分不足", ErrorCode.VALIDATION_ERROR, 400);
  }

  const note = JSON.stringify({
    reward_id: rewardDef.id,
    reward_name: rewardDef.name,
    reference_id: rewardDef.id,
  });

  await prisma.$transaction([
    prisma.pointsLedger.create({
      data: {
        userId,
        amount: -rewardDef.cost,
        reason: PointsReason.REDEMPTION,
        note,
      },
    }),
    prisma.userProfile.upsert({
      where: { userId },
      create: { userId, pointsBalance: Math.max(0, balance - rewardDef.cost) },
      update: { pointsBalance: { decrement: rewardDef.cost } },
    }),
    prisma.pointsRedemption.create({
      data: {
        userId,
        benefitName: rewardDef.name,
        pointsSpent: rewardDef.cost,
      },
    }),
  ]);

  const updated = await fetchPointsRewards(userId);
  const reward =
    updated.find((r) => r.id === rewardId) ??
    ({ ...rewardDef, status: "unlocked" } as ApiPointsReward);

  const newProfile = await prisma.userProfile.findUnique({
    where: { userId },
    select: { pointsBalance: true },
  });

  return {
    points_balance: newProfile?.pointsBalance ?? balance - rewardDef.cost,
    reward,
  };
}

export function getRewardById(rewardId: string) {
  return POINTS_REWARD_CATALOG.find((r) => r.id === rewardId) ?? null;
}
