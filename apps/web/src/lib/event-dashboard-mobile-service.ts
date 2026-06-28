import {
  EventStatus,
  LotteryStatus,
  PollStatus,
  PollType,
  StampRallyStatus,
  prisma,
} from "@connectiq/database";
import { ErrorCode } from "@connectiq/types";
import { ApiError } from "@/lib/api-auth";
import { isEventFeatureEnabled } from "@/lib/event-feature-flags-server";
import { scoreIntentMatch } from "@/lib/mobile-intent-match";
import { countUnreadNotifications } from "@/lib/mobile-notification-service";
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
};

export type ApiMobileAnnouncement = {
  id: string;
  content: string;
  time: string;
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
  announcements: ApiMobileAnnouncement[];
  stampRally: ApiMobileStampRally | null;
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

async function loadLiveInteraction(
  eventId: string,
): Promise<ApiMobileLiveInteraction | null> {
  const [livePoll, liveLottery] = await Promise.all([
    prisma.poll.findFirst({
      where: {
        eventId,
        status: PollStatus.LIVE,
        type: { not: PollType.ANNOUNCEMENT },
      },
      orderBy: { updatedAt: "desc" },
      select: { id: true, type: true, title: true, closesAt: true },
    }),
    prisma.lottery.findFirst({
      where: {
        eventId,
        status: { in: [LotteryStatus.OPEN, LotteryStatus.DRAWING] },
      },
      orderBy: { updatedAt: "desc" },
      select: { id: true, title: true },
    }),
  ]);

  if (livePoll) {
    const countdownSeconds = countdownSecondsFromClosesAt(livePoll.closesAt);
    return {
      id: livePoll.id,
      type: livePoll.type,
      title: livePoll.title,
      isLive: true,
      countdownSeconds,
      closesAt: livePoll.closesAt?.toISOString() ?? null,
    };
  }

  if (liveLottery) {
    return {
      id: liveLottery.id,
      type: "LOTTERY",
      title: liveLottery.title,
      isLive: true,
    };
  }

  return null;
}

async function loadAnnouncements(eventId: string): Promise<ApiMobileAnnouncement[]> {
  const rows = await prisma.poll.findMany({
    where: {
      eventId,
      type: PollType.ANNOUNCEMENT,
      status: { in: [PollStatus.LIVE, PollStatus.PAUSED, PollStatus.CLOSED] },
    },
    orderBy: { updatedAt: "desc" },
    take: 8,
    select: { id: true, title: true, updatedAt: true, createdAt: true },
  });

  return rows.map((row) => ({
    id: row.id,
    content: row.title,
    time: (row.updatedAt ?? row.createdAt).toISOString(),
  }));
}

async function loadStampRallySummary(
  eventId: string,
  userId: string | null,
): Promise<ApiMobileStampRally | null> {
  const enabled = await isEventFeatureEnabled(eventId, "stampRally");
  if (!enabled || !userId) return null;

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
    include: {
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

  const [aiRecommendations, liveInteraction, announcements, stampRally, unreadNotificationCount] =
    await Promise.all([
      loadAiRecommendations(eventId, userId),
      loadLiveInteraction(eventId),
      loadAnnouncements(eventId),
      loadStampRallySummary(eventId, userId),
      userId ? countUnreadNotifications(userId) : Promise.resolve(0),
    ]);

  return {
    event: {
      id: event.id,
      name: event.name,
      activityType: event.activityType,
      status: mapEventStatus(event.status),
      dayLabel: computeDayLabel(event.startDate, event.endDate),
    },
    aiRecommendations,
    liveInteraction,
    announcements,
    stampRally,
    unreadNotificationCount,
    org: event.org
      ? {
          name: event.org.name,
          isVerified: event.org.isVerified,
        }
      : null,
  };
}
