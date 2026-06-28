import { prisma } from "@connectiq/database";
import {
  buildDimensionHits,
  loadViewerProfile,
} from "@/lib/ai/matching/recall";
import { rankCandidates } from "@/lib/ai/matching/rank";
import type { PeerIntentProfile, RankedCandidate } from "@/lib/ai/matching/types";

async function loadPeerProfile(
  userId: string,
  eventId: string,
): Promise<PeerIntentProfile | null> {
  const intent = await prisma.userEventIntent.findUnique({
    where: { userId_eventId: { userId, eventId } },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          profile: { select: { company: true, industry: true } },
        },
      },
    },
  });

  if (!intent) return null;

  const participant = await prisma.participant.findFirst({
    where: {
      eventId,
      OR: [
        ...(intent.user.email ? [{ email: intent.user.email }] : []),
        ...(intent.user.phone ? [{ phone: intent.user.phone }] : []),
      ],
    },
    select: { id: true },
  });

  const checkedIn = participant
    ? Boolean(
        await prisma.checkIn.findFirst({
          where: { eventId, participantId: participant.id },
          select: { id: true },
        }),
      )
    : false;

  const signalCount = await prisma.boothVisitSignal.count({
    where: { eventId, userId },
  });

  return {
    userId: intent.userId,
    name: intent.user.name,
    company: intent.user.profile?.company ?? null,
    role: intent.role,
    industry: intent.industry ?? intent.user.profile?.industry ?? null,
    region: intent.region,
    supplyTags: intent.supplyTags,
    demandTags: intent.demandTags,
    topics: intent.topics,
    checkedIn,
    hasSignals: signalCount > 0,
  };
}

/**
 * 对指定 viewer ↔ target 计算规则匹配分与维度（无需全量 recall）。
 */
export async function matchPair(
  viewerId: string,
  targetUserId: string,
  eventId: string,
): Promise<RankedCandidate | null> {
  const [viewer, peer] = await Promise.all([
    loadViewerProfile(viewerId, eventId),
    loadPeerProfile(targetUserId, eventId),
  ]);

  if (!viewer || !peer) return null;

  const dimensions = buildDimensionHits(viewer, peer);

  const candidate = {
    userId: peer.userId,
    name: peer.name,
    company: peer.company,
    role: peer.role,
    industry: peer.industry,
    region: peer.region,
    supplyTags: peer.supplyTags,
    demandTags: peer.demandTags,
    topics: peer.topics,
    dimensions,
    recallScore: dimensions.length,
  };

  const ranked = await rankCandidates(viewerId, [candidate], { eventId });
  return ranked[0] ?? null;
}
