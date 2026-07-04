import type { OrganizerLotteryDto } from "@/lib/lottery/organizer-lottery-config";

export type BigScreenLotteryFilter = "all" | "draft" | "active" | "ended";
export type BigScreenLotterySort = "created_at" | "draw_at";

const TIER_MEDALS = ["🥇", "🥈", "🥉"] as const;

export function isPoolDrawCategory(raw: string | null): boolean {
  if (!raw) return false;
  const normalized = raw.trim().toUpperCase();
  return normalized === "POOL_DRAW" || normalized === "POOL-DRAW";
}

export function getBigScreenLifecycleStatus(status: string) {
  if (status === "DRAFT" || status === "READY") return "draft" as const;
  if (
    status === "OPEN" ||
    status === "DRAWING" ||
    status === "ACTIVE"
  ) {
    return "active" as const;
  }
  if (status === "FINISHED" || status === "ENDED") return "ended" as const;
  return "draft" as const;
}

export function getDrawStatusLabel(status: string): string {
  if (status === "DRAFT" || status === "READY") return "草稿";
  if (status === "OPEN" || status === "ACTIVE") return "待开奖";
  if (status === "DRAWING") return "进行中";
  if (status === "FINISHED" || status === "ENDED") return "已完成";
  return "草稿";
}

export function getDrawStatusVariant(
  status: string,
): "success" | "warning" | "info" | "neutral" {
  if (status === "OPEN" || status === "ACTIVE") return "warning";
  if (status === "DRAWING") return "info";
  if (status === "FINISHED" || status === "ENDED") return "neutral";
  return "neutral";
}

export function formatEligibilitySummary(
  lottery: OrganizerLotteryDto,
): string {
  const { eligibility } = lottery.meta;
  const parts: string[] = [];

  if (eligibility.require_checkin) parts.push("已签到");
  if (eligibility.min_interactions) {
    parts.push(`参与互动 ≥ ${eligibility.min_interactions}`);
  } else if (eligibility.require_checkin) {
    parts.push("参与互动");
  }
  if (eligibility.require_stamp_rally) parts.push("完成集章");
  if (eligibility.min_connections) {
    parts.push(`建立连接 ≥ ${eligibility.min_connections}`);
  }

  return parts.length > 0 ? parts.join(" + ") : "无门槛";
}

export function formatTierPreview(lottery: OrganizerLotteryDto) {
  return [...lottery.prizes]
    .sort((a, b) => a.tier - b.tier)
    .map((prize, index) => {
      const medal =
        TIER_MEDALS[Math.min(prize.tier - 1, TIER_MEDALS.length - 1)] ??
        TIER_MEDALS[Math.min(index, TIER_MEDALS.length - 1)];
      return {
        key: prize.id ?? `${prize.tier}-${prize.name}`,
        label: `${medal} ${prize.name} × ${prize.quantity}`,
      };
    });
}

export function filterBigScreenLotteries(
  lotteries: OrganizerLotteryDto[],
  filter: BigScreenLotteryFilter,
): OrganizerLotteryDto[] {
  if (filter === "all") return lotteries;
  return lotteries.filter(
    (lottery) => getBigScreenLifecycleStatus(lottery.status) === filter,
  );
}

export function sortBigScreenLotteries(
  lotteries: OrganizerLotteryDto[],
  sort: BigScreenLotterySort,
): OrganizerLotteryDto[] {
  return [...lotteries].sort((a, b) => {
    if (sort === "draw_at") {
      const aTime = a.draw_at ? new Date(a.draw_at).getTime() : 0;
      const bTime = b.draw_at ? new Date(b.draw_at).getTime() : 0;
      if (aTime !== bTime) return bTime - aTime;
    }
    return (
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  });
}

export function computeBigScreenStats(lotteries: OrganizerLotteryDto[]) {
  let activeCount = 0;
  let endedCount = 0;
  let totalEntries = 0;

  for (const lottery of lotteries) {
    const lifecycle = getBigScreenLifecycleStatus(lottery.status);
    if (lifecycle === "active") activeCount += 1;
    if (lifecycle === "ended") endedCount += 1;
    totalEntries += lottery.entry_count;
  }

  return { activeCount, endedCount, totalEntries };
}

export function formatPoolCount(value: number) {
  return value.toLocaleString("zh-CN");
}
