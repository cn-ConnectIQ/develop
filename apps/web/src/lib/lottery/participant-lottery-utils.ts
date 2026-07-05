import type { ParticipantLotteryListItem } from "@/lib/interaction/lottery-service";
import { ANIMATION_TYPE_OPTIONS } from "@/lib/lottery/probability-lottery-config";

const LOTTERY_CATEGORY_AUTO_PROBABILITY = "AUTO_PROBABILITY" as const;
const LOTTERY_CATEGORY_INSTANT_CLAIM = "INSTANT_CLAIM" as const;

export type ParticipantLotteryTypeFilter = "all" | "probability" | "instant";
export type ParticipantLotteryStatusFilter = "all" | "active" | "ended";

export function isParticipantLotteryCategoryQuery(category: string | null) {
  if (!category || category === "participant") return true;
  const parts = category.split(",").map((item) => item.trim());
  return parts.some(
    (item) => item === "AUTO_PROBABILITY" || item === "INSTANT_CLAIM",
  );
}

export function getParticipantLifecycleStatus(
  lottery: ParticipantLotteryListItem,
) {
  if (
    lottery.status === "FINISHED" ||
    lottery.status === "ENDED"
  ) {
    return "ended" as const;
  }
  if (
    lottery.status === "ACTIVE" ||
    lottery.status === "OPEN" ||
    lottery.status === "DRAWING"
  ) {
    return "active" as const;
  }
  return "draft" as const;
}

export function getParticipantDisplayStatus(lottery: ParticipantLotteryListItem) {
  if (lottery.is_stock_depleted) {
    return {
      label: "库存告罄",
      variant: "warning" as const,
    };
  }
  const lifecycle = getParticipantLifecycleStatus(lottery);
  if (lifecycle === "ended") {
    return { label: "已结束", variant: "neutral" as const };
  }
  if (lifecycle === "active") {
    return { label: "进行中", variant: "success" as const };
  }
  return { label: "草稿", variant: "neutral" as const };
}

export function getParticipantTypeEmoji(category: string) {
  return category === LOTTERY_CATEGORY_INSTANT_CLAIM ? "🎁" : "🎡";
}

export function getParticipantTypeLabel(category: string) {
  return category === LOTTERY_CATEGORY_INSTANT_CLAIM ? "直接领取" : "概率抽奖";
}

export function getAnimationBadge(animationType: string | null) {
  const option = ANIMATION_TYPE_OPTIONS.find(
    (item) => item.value === animationType,
  );
  if (!option) return null;
  return { emoji: option.emoji, title: option.title };
}

export function formatBoothChipName(lottery: ParticipantLotteryListItem) {
  if (lottery.owner_type === "ORGANIZER" && !lottery.booth) {
    return "主办方";
  }
  if (!lottery.booth) return "未关联展位";
  return lottery.booth.name.includes("展位")
    ? lottery.booth.name
    : `${lottery.booth.name}展位`;
}

export type ParticipantInitiatorFilter = "all" | "organizer" | string;

export function filterParticipantLotteries(
  lotteries: ParticipantLotteryListItem[],
  filters: {
    initiator?: ParticipantInitiatorFilter;
    boothId?: string;
    type: ParticipantLotteryTypeFilter;
    status: ParticipantLotteryStatusFilter;
  },
) {
  return lotteries.filter((lottery) => {
    if (filters.initiator === "organizer") {
      if (lottery.owner_type !== "ORGANIZER" || lottery.booth) {
        return false;
      }
    } else if (filters.initiator && filters.initiator !== "all") {
      if (lottery.booth?.id !== filters.initiator) {
        return false;
      }
    } else if (filters.boothId && lottery.booth?.id !== filters.boothId) {
      return false;
    }
    if (
      filters.type === "probability" &&
      lottery.lottery_category !== LOTTERY_CATEGORY_AUTO_PROBABILITY
    ) {
      return false;
    }
    if (
      filters.type === "instant" &&
      lottery.lottery_category !== LOTTERY_CATEGORY_INSTANT_CLAIM
    ) {
      return false;
    }
    if (filters.status === "all") return true;
    const lifecycle = getParticipantLifecycleStatus(lottery);
    if (filters.status === "active") {
      return lifecycle === "active" || lifecycle === "draft";
    }
    return lifecycle === "ended";
  });
}

export function computeParticipantStats(lotteries: ParticipantLotteryListItem[]) {
  let activeCount = 0;
  let todayEntries = 0;
  let issuedPrizes = 0;

  for (const lottery of lotteries) {
    const lifecycle = getParticipantLifecycleStatus(lottery);
    if (lifecycle === "active" && !lottery.is_stock_depleted) {
      activeCount += 1;
    }
    todayEntries += lottery.today_entry_count;
    issuedPrizes += lottery.winner_count;
  }

  return { activeCount, todayEntries, issuedPrizes };
}

export function formatParticipantCount(value: number) {
  return value.toLocaleString("zh-CN");
}

export function canPauseParticipantLottery(lottery: ParticipantLotteryListItem) {
  return lottery.status === "ACTIVE" || lottery.status === "OPEN";
}

export function canResumeParticipantLottery(
  lottery: ParticipantLotteryListItem,
) {
  return lottery.status === "DRAFT";
}

export function buildParticipantCreatePath(
  eventId: string,
  initiator: { type: "organizer" } | { type: "booth"; boothId: string },
  type: "probability" | "instant",
) {
  if (initiator.type === "organizer") {
    return type === "probability"
      ? `/events/${eventId}/lottery/participant/probability/new`
      : `/events/${eventId}/lottery/participant/instant/new`;
  }
  if (type === "probability") {
    return `/events/${eventId}/booths/${initiator.boothId}/lottery/probability/new`;
  }
  return `/events/${eventId}/booths/${initiator.boothId}/lottery/instant/new`;
}

export function buildParticipantDashboardPath(
  eventId: string,
  lottery: ParticipantLotteryListItem,
) {
  if (lottery.booth) {
    return `/events/${eventId}/booths/${lottery.booth.id}/lottery/${lottery.id}`;
  }
  if (lottery.owner_type === "ORGANIZER") {
    return `/events/${eventId}/lottery/participant/${lottery.id}`;
  }
  return null;
}
