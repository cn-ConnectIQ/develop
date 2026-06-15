import type { LotteryPrizeConfig } from "@/lib/interaction/schemas";

export type LotteryDetail = {
  id: string;
  eventId: string;
  title: string;
  description: string | null;
  type: string;
  status: string;
  prizes: LotteryPrizeConfig[];
  requireCheckin: boolean;
  requirePollId: string | null;
  quizPollId: string | null;
  eligibleRoles: string[];
  allowReenter: boolean;
  entryCount: number;
  winnerCount: number;
  boothId?: string | null;
};

export const LOTTERY_TYPE_OPTIONS = [
  {
    value: "RANDOM" as const,
    label: "随机抽奖",
    desc: "从所有参与者中随机",
    icon: "Shuffle",
    color: "text-brand-blue",
  },
  {
    value: "QUIZ_BASED" as const,
    label: "答题抽奖",
    desc: "答对才能进入奖池",
    icon: "HelpCircle",
    color: "text-brand-purple",
  },
  {
    value: "CHECKIN_BASED" as const,
    label: "签到抽奖",
    desc: "已签到自动进入奖池",
    icon: "UserCheck",
    color: "text-brand-green",
  },
  {
    value: "ACTIVITY_BASED" as const,
    label: "参与抽奖",
    desc: "参与指定互动才能参与",
    icon: "Activity",
    color: "text-brand-amber",
  },
];

export const PRIZE_RANK_LABELS: Record<number, string> = {
  1: "一等奖",
  2: "二等奖",
  3: "三等奖",
};

export function prizeRankLabel(rank: number) {
  return PRIZE_RANK_LABELS[rank] ?? "参与奖";
}

export function prizeRankBadgeClass(rank: number) {
  switch (rank) {
    case 1:
      return "bg-red-100 text-red-700";
    case 2:
      return "bg-orange-100 text-orange-600";
    case 3:
      return "bg-yellow-100 text-yellow-600";
    default:
      return "bg-gray-100 text-gray-500";
  }
}

export function summarizePrizes(prizes: LotteryPrizeConfig[]): string {
  if (!prizes.length) return "暂无奖品";
  const names = prizes
    .slice()
    .sort((a, b) => a.rank - b.rank)
    .map((p) => p.prize || p.name)
    .filter(Boolean);
  return `${prizes.length} 个奖项：${names.join(" / ")}`;
}

export function parsePrizes(raw: unknown): LotteryPrizeConfig[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((p, index) => {
    const item = p as LotteryPrizeConfig;
    return {
      rank: item.rank ?? index + 1,
      name: item.name ?? prizeRankLabel(item.rank ?? index + 1),
      prize: item.prize ?? "",
      count: item.count ?? 1,
      image_url: item.image_url,
    };
  });
}

export function normalizePrizeRanks(
  prizes: LotteryPrizeConfig[],
): LotteryPrizeConfig[] {
  return prizes.map((p, index) => ({
    ...p,
    rank: index + 1,
    name: p.name || prizeRankLabel(index + 1),
  }));
}

export const LOTTERY_STATUS_LABELS: Record<
  string,
  { label: string; className: string; pulse?: boolean }
> = {
  DRAFT: { label: "草稿", className: "bg-gray-100 text-gray-500" },
  READY: {
    label: "就绪",
    className: "bg-brand-blue-light text-brand-blue",
  },
  OPEN: {
    label: "● 报名中",
    className: "bg-brand-green-light text-brand-green",
    pulse: true,
  },
  DRAWING: {
    label: "🎲 抽取中",
    className: "bg-brand-red-light text-brand-red",
  },
  FINISHED: { label: "已结束", className: "bg-gray-100 text-gray-400" },
};
