import { MeetingStatus, prisma } from "@connectiq/database";
import { ErrorCode } from "@connectiq/types";
import { ApiError } from "@/lib/api-auth";
import { getMatchmakingConfig } from "@/lib/matchmaking-config-service";
import { scoreIntentMatch } from "@/lib/mobile-intent-match";

export type ApiPremeetRecommendation = {
  userId: string;
  name: string;
  avatar: string | null;
  company: string | null;
  title: string | null;
  matchScore: number;
  matchReason: string;
};

export type ApiPremeetStatus = {
  startsInDays: number;
  premeetEnabled: boolean;
  confirmedHighMatchCount: number;
  recommendations: ApiPremeetRecommendation[];
};

const HIGH_MATCH_THRESHOLD = 50;

function computeStartsInDays(startDate: Date | null): number {
  if (!startDate) return 0;
  const now = new Date();
  if (now >= startDate) return 0;
  return Math.ceil((startDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
}

function isPremeetOpen(
  premeetEnabled: boolean,
  premeetOpenAt: string | null,
  premeetOpenAtComputed: string | null,
): boolean {
  if (!premeetEnabled) return false;
  const openAt = premeetOpenAt ?? premeetOpenAtComputed;
  if (!openAt) return true;
  return new Date() >= new Date(openAt);
}

export async function getEventPremeetStatus(
  eventId: string,
  userId: string | null,
): Promise<ApiPremeetStatus> {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, startDate: true },
  });
  if (!event) {
    throw new ApiError("活动不存在", ErrorCode.NOT_FOUND, 404);
  }

  const config = await getMatchmakingConfig(eventId);
  const premeetEnabled = isPremeetOpen(
    config.premeet_enabled,
    config.premeet_open_at,
    config.premeet_open_at_computed,
  );

  const myIntent = userId
    ? await prisma.userEventIntent.findUnique({
        where: { userId_eventId: { userId, eventId } },
      })
    : null;

  const peerIntents = await prisma.userEventIntent.findMany({
    where: {
      eventId,
      ...(userId ? { userId: { not: userId } } : {}),
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
    take: 40,
  });

  const recommendations: ApiPremeetRecommendation[] = peerIntents
    .map((peer) => {
      const match = myIntent
        ? scoreIntentMatch(myIntent, peer)
        : { score: 10, reason: "同场参会者，值得认识" };
      const matchScore = match.score + (peer.role ? 5 : 0);

      return {
        userId: peer.user.id,
        name: peer.user.name,
        avatar: null as string | null,
        company: peer.user.profile?.company ?? null,
        title: peer.role ?? peer.user.profile?.valueProposition ?? null,
        matchScore,
        matchReason: match.reason,
      };
    })
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, 8);

  const highMatchUserIds = recommendations
    .filter((r) => r.matchScore >= HIGH_MATCH_THRESHOLD)
    .map((r) => r.userId);

  let confirmedHighMatchCount = 0;
  if (userId && highMatchUserIds.length > 0) {
    const [acceptedMeetings, confirmedIntents] = await Promise.all([
      prisma.meeting.count({
        where: {
          eventId,
          status: MeetingStatus.ACCEPTED,
          OR: [
            {
              requesterId: userId,
              recipientId: { in: highMatchUserIds },
            },
            {
              recipientId: userId,
              requesterId: { in: highMatchUserIds },
            },
          ],
        },
      }),
      prisma.userEventIntent.count({
        where: {
          eventId,
          userId: { in: highMatchUserIds },
          OR: [
            { supplyTags: { isEmpty: false } },
            { demandTags: { isEmpty: false } },
          ],
        },
      }),
    ]);
    confirmedHighMatchCount = Math.max(acceptedMeetings, confirmedIntents);
  }

  return {
    startsInDays: computeStartsInDays(event.startDate),
    premeetEnabled,
    confirmedHighMatchCount,
    recommendations,
  };
}
