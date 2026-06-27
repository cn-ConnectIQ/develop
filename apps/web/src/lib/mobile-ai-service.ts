import {
  ConnectionStatus,
  ExchangeStatus,
  prisma,
} from "@connectiq/database";
import { ErrorCode } from "@connectiq/types";
import { ApiError } from "@/lib/api-auth";
import { fetchConnectCard } from "@/lib/connect-card-service";
import { scoreIntentMatch } from "@/lib/mobile-intent-match";

export type ApiMatchPreviewPerson = {
  user_id: string;
  name: string;
  avatar_url?: string;
  company?: string;
  title?: string;
  match_score: number;
  match_reason: string;
};

function clampRate(value: number): number {
  return Math.max(5, Math.min(95, Math.round(value)));
}

export async function getMatchPreviewForUser(
  userId: string,
  eventId: string,
): Promise<ApiMatchPreviewPerson[]> {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true },
  });
  if (!event) {
    throw new ApiError("活动不存在", ErrorCode.NOT_FOUND, 404);
  }

  const myIntent = await prisma.userEventIntent.findUnique({
    where: { userId_eventId: { userId, eventId } },
  });

  const peerIntents = await prisma.userEventIntent.findMany({
    where: {
      eventId,
      userId: { not: userId },
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

  return peerIntents
    .map((peer) => {
      const match = myIntent
        ? scoreIntentMatch(myIntent, peer)
        : { score: 15, reason: "同场参会者，值得认识" };
      return {
        user_id: peer.user.id,
        name: peer.user.name,
        company: peer.user.profile?.company ?? undefined,
        title: peer.role ?? peer.user.profile?.valueProposition ?? undefined,
        match_score: Math.min(99, match.score + (peer.role ? 8 : 0) + 20),
        match_reason: match.reason,
      };
    })
    .sort((a, b) => b.match_score - a.match_score)
    .slice(0, 12);
}

export async function getConnectionNoteSuggestion(
  viewerId: string,
  targetId: string,
  options?: { eventId?: string; refresh?: boolean },
): Promise<{ note: string; accept_rate: number; text?: string }> {
  if (viewerId === targetId) {
    throw new ApiError("不能对自己生成话术", ErrorCode.VALIDATION_ERROR, 400);
  }

  void options?.refresh;
  const card = await fetchConnectCard(viewerId, targetId, options?.eventId);
  const note = buildConnectionNoteFromCard(
    card.user.name,
    card.matchReason,
    card.sharedIntents,
  );
  const accept_rate = await predictAcceptRate(viewerId, targetId, note, options?.eventId);

  return { note, text: note, accept_rate };
}

function buildConnectionNoteFromCard(
  targetName: string,
  matchReason: string | null,
  sharedIntents: Array<{ label: string; description: string }>,
): string {
  const topic =
    sharedIntents[0]?.label ??
    (matchReason ? matchReason.replace(/。.*$/, "") : "现场交流");
  return `你好 ${targetName}，我在关注「${topic}」，觉得我们在这块可能有合作空间，方便现场聊聊吗？`;
}

export async function predictAcceptRate(
  viewerId: string,
  targetId: string,
  requestNote: string,
  eventId?: string,
): Promise<number> {
  const [viewerIntent, targetIntent, existingConnection, priorRequests] =
    await Promise.all([
      eventId
        ? prisma.userEventIntent.findUnique({
            where: { userId_eventId: { userId: viewerId, eventId } },
          })
        : Promise.resolve(null),
      eventId
        ? prisma.userEventIntent.findUnique({
            where: { userId_eventId: { userId: targetId, eventId } },
          })
        : Promise.resolve(null),
      prisma.businessConnection.findFirst({
        where: {
          status: ConnectionStatus.ACTIVE,
          OR: [
            { userAId: viewerId, userBId: targetId },
            { userAId: targetId, userBId: viewerId },
          ],
        },
      }),
      prisma.exchangeRequest.count({
        where: {
          status: ExchangeStatus.ACCEPTED,
          OR: [{ fromUserId: viewerId }, { toUserId: viewerId }],
        },
      }),
    ]);

  if (existingConnection) return 92;

  let rate = 38;
  if (viewerIntent && targetIntent) {
    const match = scoreIntentMatch(viewerIntent, targetIntent);
    rate += Math.min(35, match.score);
  }

  const noteLen = requestNote.trim().length;
  if (noteLen >= 20 && noteLen <= 160) rate += 12;
  if (noteLen > 160) rate -= 8;
  if (priorRequests >= 3) rate += 6;

  const card = await fetchConnectCard(viewerId, targetId, eventId).catch(() => null);
  if (card?.aiMatchScore) {
    rate += Math.min(20, Math.round(card.aiMatchScore / 5));
  }

  return clampRate(rate);
}

export async function getScanBrief(
  viewerId: string,
  targetUserId: string,
  eventId?: string,
) {
  const card = await fetchConnectCard(viewerId, targetUserId, eventId);
  const accept_rate = await predictAcceptRate(
    viewerId,
    targetUserId,
    card.aiBrief,
    eventId,
  );

  return {
    content: card.aiBrief,
    intent_match: card.sharedIntents[0]
      ? {
          label: card.sharedIntents[0].label,
          description: card.sharedIntents[0].description,
        }
      : undefined,
    accept_rate,
  };
}
