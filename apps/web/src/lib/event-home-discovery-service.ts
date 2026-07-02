import {
  LotteryStatus,
  prisma,
} from "@connectiq/database";
import { ErrorCode } from "@connectiq/types";
import { ApiError } from "@/lib/api-auth";
import { parseIntentTags } from "@/lib/user-me-service";
import { isEventFeatureEnabled } from "@/lib/event-feature-flags-server";

export type ApiActiveLotteryItem = {
  lottery_id: string;
  booth_id: string | null;
  exhibitor_name: string;
  prize_name: string;
  prize_image_url: string | null;
  participant_count: number;
  kind: "booth_lottery" | "ai_recommended";
  ai_match_reason: string | null;
  priority: number;
};

function prizeNameFromLottery(lottery: {
  title: string;
  prizeItems: Array<{ name: string }>;
  prizes: unknown;
}): string {
  if (lottery.prizeItems.length > 0) return lottery.prizeItems[0]!.name;
  if (Array.isArray(lottery.prizes) && lottery.prizes.length > 0) {
    const first = lottery.prizes[0] as { name?: string; prize?: string };
    return first.name ?? first.prize ?? lottery.title;
  }
  return lottery.title;
}

function scoreBoothLottery(
  booth: {
    companyOrg: { name: string; industry: string | null; bio: string | null };
    name: string;
  },
  demandTags: string[],
): { score: number; reason: string | null } {
  if (demandTags.length === 0) {
    return { score: 0, reason: null };
  }
  const hay = [
    booth.companyOrg.name,
    booth.companyOrg.industry ?? "",
    booth.companyOrg.bio ?? "",
    booth.name,
  ]
    .join(" ")
    .toLowerCase();

  let hits = 0;
  for (const tag of demandTags) {
    if (hay.includes(tag.toLowerCase())) hits += 1;
  }
  if (hits === 0) return { score: 0, reason: null };
  return {
    score: hits * 12 + 8,
    reason: `AI 推荐：${booth.companyOrg.name}的产品与你匹配，他们正在抽奖`,
  };
}

export async function listActiveLotteriesForEvent(
  eventId: string,
  userId: string | null,
): Promise<ApiActiveLotteryItem[]> {
  const enabled = await isEventFeatureEnabled(eventId, "lottery");
  if (!enabled) return [];

  const lotteries = await prisma.lottery.findMany({
    where: {
      eventId,
      status: { in: [LotteryStatus.OPEN, LotteryStatus.DRAWING] },
    },
    include: {
      booth: {
        select: {
          id: true,
          name: true,
          code: true,
          companyOrg: {
            select: { name: true, industry: true, bio: true },
          },
        },
      },
      prizeItems: { orderBy: { sortOrder: "asc" }, take: 1 },
      _count: { select: { entries: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 20,
  });

  if (lotteries.length === 0) return [];

  let demandTags: string[] = [];
  if (userId) {
    const intent = await prisma.userEventIntent.findUnique({
      where: { userId_eventId: { userId, eventId } },
    });
    if (intent) {
      demandTags = [
        ...parseIntentTags(intent.demandTags),
        ...parseIntentTags(intent.supplyTags),
      ].map((tag) => tag.label);
    }
  }

  const scored = lotteries.map((lottery, index) => {
    const exhibitorName =
      lottery.booth?.companyOrg.name ??
      lottery.booth?.name ??
      "现场展商";
    const boothId = lottery.boothId;
    const ai = lottery.booth
      ? scoreBoothLottery(lottery.booth, demandTags)
      : { score: 0, reason: null as string | null };

    const basePriority = 100 - index;
    const kind: ApiActiveLotteryItem["kind"] =
      ai.score > 0 ? "ai_recommended" : "booth_lottery";

    return {
      lottery_id: lottery.id,
      booth_id: boothId,
      exhibitor_name: exhibitorName,
      prize_name: prizeNameFromLottery(lottery),
      prize_image_url: lottery.coverImage,
      participant_count: lottery._count.entries,
      kind,
      ai_match_reason: ai.reason,
      priority: basePriority + ai.score + (boothId ? 20 : 10),
    } satisfies ApiActiveLotteryItem;
  });

  return scored.sort((a, b) => b.priority - a.priority);
}

export type ApiHomeStampProgress = {
  started: boolean;
  rally_id: string | null;
  stamped_count: number;
  required_count: number;
  remaining: number;
  reward_title: string | null;
  linked_lottery_hint: string | null;
};

export async function getHomeStampProgress(
  eventId: string,
  userId: string,
): Promise<ApiHomeStampProgress> {
  const { getAttendeeStampRallyProgress } = await import(
    "@/lib/stamp/stamp-collect-service"
  );

  try {
    const progress = await getAttendeeStampRallyProgress(eventId, userId);
    const remaining = Math.max(progress.required_count - progress.stamped_count, 0);
    return {
      started: progress.stamped_count > 0,
      rally_id: progress.rally_id,
      stamped_count: progress.stamped_count,
      required_count: progress.required_count,
      remaining,
      reward_title: progress.prize,
      linked_lottery_hint:
        remaining > 0
          ? `再逛 ${remaining} 个展位，集满可抽大奖`
          : null,
    };
  } catch (err) {
    if (err instanceof ApiError && err.statusCode === 404) {
      return {
        started: false,
        rally_id: null,
        stamped_count: 0,
        required_count: 0,
        remaining: 0,
        reward_title: null,
        linked_lottery_hint: null,
      };
    }
    throw err;
  }
}
