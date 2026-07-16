import {
  EventStatus,
  LotteryCategory,
  LotteryOwnerType,
  LotteryStatus,
  PollStatus,
  PollType,
  StampRallyStatus,
  prisma,
} from "@connectiq/database";
import { ErrorCode } from "@connectiq/types";
import { ApiError } from "@/lib/api-auth";
import {
  parseEventFeatureFlags,
  type EventFeatureFlags,
} from "@/lib/event-feature-flags";
import { scoreIntentMatch } from "@/lib/mobile-intent-match";
import { countUnreadNotifications } from "@/lib/mobile-notification-service";
import { getStampPassportForEvent } from "@/lib/stamp-rally-service";
import { loadLatestAvatarUrlMap } from "@/lib/user-me-service";

export type ApiMobileHomeEvent = {
  id: string;
  name: string;
  activityType: string;
  status: "DRAFT" | "PUBLISHED" | "LIVE" | "ENDED";
  dayLabel: string;
};

export type ApiMobileAiRecommendation = {
  userId: string;
  name: string;
  avatar: string | null;
  company: string | null;
  title: string | null;
  matchReason: string;
};

export type ApiMobileLiveInteraction = {
  id: string;
  type: string;
  title: string;
  isLive: boolean;
  countdownSeconds?: number | null;
  closesAt?: string | null;
  /** 展示标签，如「有奖投票」 */
  label?: string;
  boothId?: string;
  boothCode?: string;
  stampCurrent?: number;
  stampTotal?: number;
};

export type ApiMobileAnnouncement = {
  id: string;
  title: string;
  content: string;
  is_pinned: boolean;
  published_at: string;
  /** @deprecated 使用 published_at */
  time?: string;
};

export type ApiMobileStampRally = {
  id: string;
  current: number;
  total: number;
  prize: string;
};

export type ApiMobileHomeOrg = {
  name: string;
  isVerified: boolean;
};

export type ApiEventDashboardMobile = {
  event: ApiMobileHomeEvent;
  aiRecommendations: ApiMobileAiRecommendation[];
  liveInteraction: ApiMobileLiveInteraction | null;
  liveInteractions: ApiMobileLiveInteraction[];
  activeLottery: ApiMobileLiveInteraction | null;
  announcements: ApiMobileAnnouncement[];
  stampRally: ApiMobileStampRally | null;
  stampEnabled: boolean;
  stampPassport: Awaited<ReturnType<typeof getStampPassportForEvent>> | null;
  unreadNotificationCount: number;
  org: ApiMobileHomeOrg | null;
};

function mapEventStatus(status: EventStatus): ApiMobileHomeEvent["status"] {
  if (status === EventStatus.ARCHIVED) return "ENDED";
  if (status === EventStatus.LIVE) return "LIVE";
  if (status === EventStatus.PUBLISHED) return "PUBLISHED";
  return "DRAFT";
}

function computeDayLabel(startDate: Date | null, endDate: Date | null): string {
  const now = new Date();
  if (!startDate) return "活动进行中";
  if (now < startDate) {
    const days = Math.ceil(
      (startDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000),
    );
    return days <= 1 ? "明天开始" : `${days} 天后开始`;
  }
  if (endDate && now > endDate) return "已结束";
  const dayIndex =
    Math.floor((now.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000)) +
    1;
  return `进行中 · 第 ${Math.max(1, dayIndex)} 天`;
}

function countdownSecondsFromClosesAt(closesAt: Date | null | undefined): number | null {
  if (!closesAt) return null;
  const diff = closesAt.getTime() - Date.now();
  if (!Number.isFinite(diff)) return null;
  return Math.max(0, Math.round(diff / 1000));
}

async function loadAiRecommendations(
  eventId: string,
  userId: string | null,
): Promise<ApiMobileAiRecommendation[]> {
  if (!userId) return [];

  const myIntent = await prisma.userEventIntent.findUnique({
    where: { userId_eventId: { userId, eventId } },
  });

  const peerIntents = await prisma.userEventIntent.findMany({
    where: {
      eventId,
      userId: { not: userId },
      OR: [
        { supplyTags: { isEmpty: false } },
        { demandTags: { isEmpty: false } },
        { role: { not: null } },
      ],
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          profile: { select: { company: true, valueProposition: true } },
        },
      },
    },
    take: 30,
  });

  if (peerIntents.length === 0) return [];

  const avatarByUserId = await loadLatestAvatarUrlMap(
    peerIntents.map((peer) => peer.user.id),
  );

  const scored = peerIntents
    .map((peer) => {
      const match = myIntent
        ? scoreIntentMatch(myIntent, peer)
        : { score: 10, reason: "同场参会者，值得认识" };

      return {
        userId: peer.user.id,
        name: peer.user.name,
        avatar: avatarByUserId.get(peer.user.id) ?? null,
        company: peer.user.profile?.company ?? null,
        title: peer.role ?? peer.user.profile?.valueProposition ?? null,
        matchReason: match.reason,
        score: match.score + (peer.role ? 5 : 0),
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);

  return scored.map(({ score: _score, ...row }) => row);
}

/** 主页同时展示：有奖投票 / 集章打卡 / 展位打卡抽奖 */
async function loadLiveInteractions(
  eventId: string,
  userId: string | null,
  featureFlags: EventFeatureFlags,
): Promise<ApiMobileLiveInteraction[]> {
  const items: ApiMobileLiveInteraction[] = [];

  const prizePoll = await prisma.poll.findFirst({
    where: {
      eventId,
      status: PollStatus.LIVE,
      type: { notIn: [PollType.ANNOUNCEMENT, PollType.QNA] },
      OR: [
        { title: { contains: "有奖", mode: "insensitive" } },
        { title: { contains: "投票", mode: "insensitive" } },
      ],
    },
    orderBy: { updatedAt: "desc" },
    select: { id: true, type: true, title: true, closesAt: true },
  });

  const fallbackPoll =
    prizePoll ??
    (await prisma.poll.findFirst({
      where: {
        eventId,
        status: PollStatus.LIVE,
        type: { notIn: [PollType.ANNOUNCEMENT, PollType.QNA] },
      },
      orderBy: { updatedAt: "desc" },
      select: { id: true, type: true, title: true, closesAt: true },
    }));

  if (fallbackPoll) {
    items.push({
      id: fallbackPoll.id,
      type: "POLL",
      title: fallbackPoll.title,
      isLive: true,
      label: prizePoll ? "有奖投票" : "现场投票",
      countdownSeconds: countdownSecondsFromClosesAt(fallbackPoll.closesAt),
      closesAt: fallbackPoll.closesAt?.toISOString() ?? null,
    });
  }

  if (featureFlags.stampRally) {
    const rally = await prisma.stampRally.findFirst({
      where: { eventId, status: StampRallyStatus.ACTIVE },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, requiredCount: true, prize: true },
    });
    if (rally) {
      const current = userId
        ? await prisma.stampRecord.count({
            where: { rallyId: rally.id, userId },
          })
        : 0;
      items.push({
        id: rally.id,
        type: "STAMP",
        title: rally.name,
        isLive: true,
        label: "集章打卡",
        stampCurrent: current,
        stampTotal: rally.requiredCount,
      });
    }
  }

  if (featureFlags.lottery) {
    const boothLottery = await prisma.lottery.findFirst({
      where: {
        eventId,
        boothId: { not: null },
        status: { in: [LotteryStatus.OPEN, LotteryStatus.DRAWING] },
      },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        title: true,
        booth: { select: { id: true, code: true, name: true } },
      },
    });
    if (boothLottery?.booth) {
      items.push({
        id: boothLottery.id,
        type: "LOTTERY",
        title: boothLottery.title,
        isLive: true,
        label: "展位打卡抽奖",
        boothId: boothLottery.booth.id,
        boothCode: boothLottery.booth.code,
      });
    }
  }

  return items;
}

async function loadActiveLottery(
  eventId: string,
  featureFlags: EventFeatureFlags,
): Promise<ApiMobileLiveInteraction | null> {
  if (!featureFlags.lottery) return null;

  const poolLottery = await prisma.lottery.findFirst({
    where: {
      eventId,
      ownerType: LotteryOwnerType.ORGANIZER,
      boothId: null,
      lotteryCategory: LotteryCategory.POOL_DRAW,
      status: { in: [LotteryStatus.OPEN, LotteryStatus.DRAWING] },
    },
    orderBy: { updatedAt: "desc" },
    select: { id: true, title: true },
  });

  if (poolLottery) {
    return {
      id: poolLottery.id,
      type: "LOTTERY",
      title: poolLottery.title,
      isLive: true,
      label: "闭幕大抽奖",
    };
  }

  const lottery = await prisma.lottery.findFirst({
    where: {
      eventId,
      status: { in: [LotteryStatus.OPEN, LotteryStatus.DRAWING] },
    },
    orderBy: { updatedAt: "desc" },
    select: { id: true, title: true, boothId: true },
  });

  if (!lottery) return null;

  return {
    id: lottery.id,
    type: "LOTTERY",
    title: lottery.title,
    isLive: true,
    label: lottery.boothId ? "展位打卡抽奖" : "现场抽奖",
    boothId: lottery.boothId ?? undefined,
  };
}

async function loadAnnouncements(eventId: string): Promise<ApiMobileAnnouncement[]> {
  const rows = await prisma.announcement.findMany({
    where: { eventId },
    orderBy: [{ isPinned: "desc" }, { publishedAt: "desc" }],
    take: 8,
    select: {
      id: true,
      title: true,
      content: true,
      isPinned: true,
      publishedAt: true,
    },
  });

  if (rows.length > 0) {
    return rows.map((row) => {
      const publishedAt = row.publishedAt.toISOString();
      return {
        id: row.id,
        title: row.title,
        content: row.content,
        is_pinned: row.isPinned,
        published_at: publishedAt,
        time: publishedAt,
      };
    });
  }

  // 兼容旧数据：PollType.ANNOUNCEMENT
  const legacy = await prisma.poll.findMany({
    where: {
      eventId,
      type: PollType.ANNOUNCEMENT,
      status: { in: [PollStatus.LIVE, PollStatus.PAUSED, PollStatus.CLOSED] },
    },
    orderBy: { updatedAt: "desc" },
    take: 8,
    select: { id: true, title: true, updatedAt: true, createdAt: true },
  });

  return legacy.map((row) => {
    const publishedAt = (row.updatedAt ?? row.createdAt).toISOString();
    const text = row.title;
    return {
      id: row.id,
      title: text,
      content: text,
      is_pinned: false,
      published_at: publishedAt,
      time: publishedAt,
    };
  });
}

async function loadStampRallySummary(
  eventId: string,
  userId: string | null,
  featureFlags: EventFeatureFlags,
): Promise<ApiMobileStampRally | null> {
  if (!featureFlags.stampRally || !userId) return null;

  const rally = await prisma.stampRally.findFirst({
    where: {
      eventId,
      status: StampRallyStatus.ACTIVE,
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, requiredCount: true, prize: true },
  });

  if (!rally) return null;

  const current = await prisma.stampRecord.count({
    where: { rallyId: rally.id, userId },
  });

  return {
    id: rally.id,
    current,
    total: rally.requiredCount,
    prize: rally.prize,
  };
}

export async function getEventDashboardMobile(
  eventId: string,
  userId: string | null,
): Promise<ApiEventDashboardMobile> {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      name: true,
      activityType: true,
      status: true,
      startDate: true,
      endDate: true,
      featureFlags: true,
      org: {
        select: {
          name: true,
          isVerified: true,
        },
      },
    },
  });

  if (!event) {
    throw new ApiError("活动不存在", ErrorCode.NOT_FOUND, 404);
  }

  const featureFlags = parseEventFeatureFlags(event.featureFlags ?? null);

  // 分两批查询，避免 Supabase Session Pooler 在 Promise.all 下连接数打满导致 500
  const [liveInteractions, activeLottery, announcements] = await Promise.all([
    loadLiveInteractions(eventId, userId, featureFlags),
    loadActiveLottery(eventId, featureFlags),
    loadAnnouncements(eventId),
  ]);

  let aiRecommendations: ApiMobileAiRecommendation[] = [];
  let stampRally: ApiMobileStampRally | null = null;
  let stampPassport: Awaited<ReturnType<typeof getStampPassportForEvent>> | null =
    null;
  let unreadNotificationCount = 0;

  if (userId) {
    [aiRecommendations, stampRally, stampPassport, unreadNotificationCount] =
      await Promise.all([
        loadAiRecommendations(eventId, userId),
        loadStampRallySummary(eventId, userId, featureFlags),
        featureFlags.stampRally
          ? getStampPassportForEvent(eventId, userId).catch(() => null)
          : Promise.resolve(null),
        countUnreadNotifications(userId),
      ]);
  }

  const liveInteraction =
    liveInteractions.find(
      (i) => i.type !== "STAMP" && i.type !== "LOTTERY",
    ) ?? liveInteractions[0] ?? null;

  return {
    event: {
      id: event.id,
      name: event.name,
      activityType: event.activityType,
      status: mapEventStatus(event.status),
      dayLabel: computeDayLabel(event.startDate, event.endDate),
    },
    aiRecommendations,
    liveInteraction: liveInteractions[0] ?? liveInteraction,
    liveInteractions,
    activeLottery,
    announcements,
    stampRally,
    stampEnabled: Boolean(stampRally ?? stampPassport),
    stampPassport,
    unreadNotificationCount,
    org: event.org
      ? {
          name: event.org.name,
          isVerified: event.org.isVerified,
        }
      : null,
  };
}
