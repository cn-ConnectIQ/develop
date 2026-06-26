import { ConnectionStatus, prisma } from "@connectiq/database";
import { ErrorCode } from "@connectiq/types";
import { ApiError } from "@/lib/api-auth";
import { findParticipantForUser } from "@/lib/interaction/participant-user";
import { scoreIntentMatch } from "@/lib/mobile-intent-match";

export type ApiMySummaryAiFollowup = {
  userId: string;
  name: string;
  avatar: string | null;
  matchReason: string;
};

export type ApiEventMySummary = {
  event: { name: string };
  connections: number;
  wechatExchanged: number;
  stampsAndInteractions: number;
  aiFollowups: ApiMySummaryAiFollowup[];
};

export async function getEventMySummary(
  eventId: string,
  userId: string,
): Promise<ApiEventMySummary> {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, name: true },
  });
  if (!event) {
    throw new ApiError("活动不存在", ErrorCode.NOT_FOUND, 404);
  }

  const [connections, wechatExchanged, participant, myIntent, peerIntents] =
    await Promise.all([
      prisma.businessConnection.count({
        where: {
          eventId,
          status: ConnectionStatus.ACTIVE,
          OR: [{ userAId: userId }, { userBId: userId }],
        },
      }),
      prisma.businessConnection.count({
        where: {
          eventId,
          status: ConnectionStatus.ACTIVE,
          wechatExchanged: true,
          OR: [{ userAId: userId }, { userBId: userId }],
        },
      }),
      findParticipantForUser(eventId, userId),
      prisma.userEventIntent.findUnique({
        where: { userId_eventId: { userId, eventId } },
      }),
      prisma.userEventIntent.findMany({
        where: {
          eventId,
          userId: { not: userId },
          OR: [
            { supplyTags: { isEmpty: false } },
            { demandTags: { isEmpty: false } },
          ],
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              profile: { select: { company: true } },
            },
          },
        },
        take: 20,
      }),
    ]);

  let stampsAndInteractions = 0;
  const [stampCount, lotteryCount] = await Promise.all([
    prisma.stampRecord.count({
      where: { userId, rally: { eventId } },
    }),
    prisma.lotteryEntry.count({ where: { userId, lottery: { eventId } } }),
  ]);
  stampsAndInteractions = stampCount + lotteryCount;
  if (participant) {
    const pollCount = await prisma.pollResponse.count({
      where: { participantId: participant.id, poll: { eventId } },
    });
    stampsAndInteractions += pollCount;
  }

  const connectedUserIds = new Set<string>();
  if (connections > 0) {
    const rows = await prisma.businessConnection.findMany({
      where: {
        eventId,
        status: ConnectionStatus.ACTIVE,
        OR: [{ userAId: userId }, { userBId: userId }],
      },
      select: { userAId: true, userBId: true, wechatExchanged: true },
    });
    for (const row of rows) {
      const peerId = row.userAId === userId ? row.userBId : row.userAId;
      if (peerId) connectedUserIds.add(peerId);
    }
  }

  const aiFollowups: ApiMySummaryAiFollowup[] = peerIntents
    .filter((peer) => !connectedUserIds.has(peer.userId))
    .map((peer) => {
      const match = myIntent
        ? scoreIntentMatch(myIntent, peer)
        : { score: 10, reason: "值得会后跟进" };
      return {
        userId: peer.user.id,
        name: peer.user.name,
        avatar: null as string | null,
        matchReason: match.reason,
        score: match.score,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map(({ score: _score, ...row }) => row);

  return {
    event: { name: event.name },
    connections,
    wechatExchanged,
    stampsAndInteractions,
    aiFollowups,
  };
}
