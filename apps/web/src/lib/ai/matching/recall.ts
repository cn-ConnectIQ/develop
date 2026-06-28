import {
  ConnectionStatus,
  ExchangeStatus,
  prisma,
} from "@connectiq/database";
import {
  loadUserEventIntentEmbedding,
  querySimilarIntentEmbeddings,
} from "@/lib/ai/embedding";
import { findParticipantForUser } from "@/lib/interaction/participant-user";
import {
  DEFAULT_RECALL_LIMITS,
  DEFAULT_VECTOR_MIN_SIMILARITY,
  DEFAULT_VECTOR_RECALL_LIMIT,
  ROLE_COMPLEMENT_PAIRS,
  type RecallLimits,
} from "./config";
import type {
  MatchDimensionHit,
  PeerIntentProfile,
  RecallCandidate,
  ViewerIntentProfile,
} from "./types";

function normalizeTag(tag: string): string {
  return tag.trim().toLowerCase();
}

function tagMap(tags: string[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const tag of tags) {
    const key = normalizeTag(tag);
    if (key) map.set(key, tag.trim());
  }
  return map;
}

function intersectTags(
  left: Map<string, string>,
  right: Map<string, string>,
): string[] {
  const hits: string[] = [];
  for (const [key, label] of left) {
    if (right.has(key)) hits.push(label);
  }
  return hits;
}

function isRoleComplement(roleA: string | null, roleB: string | null): boolean {
  if (!roleA || !roleB) return false;
  const a = roleA.trim();
  const b = roleB.trim();
  return ROLE_COMPLEMENT_PAIRS.some(([x, y]) => x === a && y === b);
}

function buildDimensionHits(
  viewer: ViewerIntentProfile,
  peer: PeerIntentProfile,
): MatchDimensionHit[] {
  const hits: MatchDimensionHit[] = [];

  const viewerSupply = tagMap(viewer.supplyTags);
  const viewerDemand = tagMap(viewer.demandTags);
  const viewerTopics = tagMap(viewer.topics);
  const peerSupply = tagMap(peer.supplyTags);
  const peerDemand = tagMap(peer.demandTags);
  const peerTopics = tagMap(peer.topics);

  for (const tag of intersectTags(viewerDemand, peerSupply)) {
    hits.push({
      dimension: "demand_supply",
      label: `你寻找 ${tag} ↔ 对方提供 ${tag}`,
      detail: tag,
    });
  }

  for (const tag of intersectTags(viewerSupply, peerDemand)) {
    hits.push({
      dimension: "supply_demand",
      label: `你提供 ${tag} ↔ 对方寻找 ${tag}`,
      detail: tag,
    });
  }

  if (isRoleComplement(viewer.role, peer.role)) {
    hits.push({
      dimension: "role_complement",
      label: `角色互补：${viewer.role} ↔ ${peer.role}`,
      detail: `${viewer.role}/${peer.role}`,
    });
  }

  for (const topic of intersectTags(viewerTopics, peerTopics)) {
    hits.push({
      dimension: "shared_topic",
      label: `共同关注 ${topic}`,
      detail: topic,
    });
  }

  if (
    viewer.industry &&
    peer.industry &&
    normalizeTag(viewer.industry) === normalizeTag(peer.industry)
  ) {
    hits.push({
      dimension: "shared_industry",
      label: `同行业：${peer.industry}`,
      detail: peer.industry,
    });
  }

  if (viewer.checkedIn && peer.checkedIn) {
    hits.push({
      dimension: "co_presence",
      label: "同场参会",
    });
  }

  if (peer.hasSignals) {
    hits.push({
      dimension: "interaction",
      label: "对方有现场行为信号",
    });
  }

  return hits;
}

async function loadExcludedUserIds(userId: string, eventId: string) {
  const excluded = new Set<string>([userId]);

  const [connections, declinedExchanges] = await Promise.all([
    prisma.businessConnection.findMany({
      where: {
        status: ConnectionStatus.ACTIVE,
        OR: [{ userAId: userId }, { userBId: userId }],
      },
      select: { userAId: true, userBId: true },
    }),
    prisma.exchangeRequest.findMany({
      where: {
        status: ExchangeStatus.DECLINED,
        eventId,
        OR: [{ fromUserId: userId }, { toUserId: userId }],
      },
      select: { fromUserId: true, toUserId: true },
    }),
  ]);

  for (const c of connections) {
    if (c.userAId && c.userAId !== userId) excluded.add(c.userAId);
    if (c.userBId && c.userBId !== userId) excluded.add(c.userBId);
  }

  for (const req of declinedExchanges) {
    if (req.fromUserId !== userId) excluded.add(req.fromUserId);
    if (req.toUserId !== userId) excluded.add(req.toUserId);
  }

  return excluded;
}

async function loadViewerProfile(
  userId: string,
  eventId: string,
): Promise<ViewerIntentProfile | null> {
  const [intent, participant, signalRows] = await Promise.all([
    prisma.userEventIntent.findUnique({
      where: { userId_eventId: { userId, eventId } },
    }),
    findParticipantForUser(eventId, userId),
    prisma.boothVisitSignal.findMany({
      where: { eventId },
      select: { userId: true },
      distinct: ["userId"],
    }),
  ]);

  const checkedIn = participant
    ? Boolean(
        await prisma.checkIn.findFirst({
          where: { eventId, participantId: participant.id },
          select: { id: true },
        }),
      )
    : false;

  const signalUserIds = new Set(signalRows.map((r) => r.userId));

  if (!intent && !checkedIn) return null;

  return {
    userId,
    role: intent?.role ?? null,
    industry: intent?.industry ?? null,
    region: intent?.region ?? null,
    supplyTags: intent?.supplyTags ?? [],
    demandTags: intent?.demandTags ?? [],
    topics: intent?.topics ?? [],
    checkedIn,
    signalUserIds,
  };
}

async function loadPeerProfiles(
  eventId: string,
  excluded: Set<string>,
): Promise<PeerIntentProfile[]> {
  const intents = await prisma.userEventIntent.findMany({
    where: {
      eventId,
      userId: { notIn: [...excluded] },
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          profile: { select: { company: true, industry: true } },
        },
      },
    },
  });

  if (intents.length === 0) return [];

  const userIds = intents.map((i) => i.userId);

  const [participants, checkIns, signalCounts] = await Promise.all([
    prisma.participant.findMany({
      where: { eventId },
      select: { id: true, email: true, phone: true },
    }),
    prisma.checkIn.findMany({
      where: { eventId },
      select: { participantId: true },
    }),
    prisma.boothVisitSignal.groupBy({
      by: ["userId"],
      where: { eventId, userId: { in: userIds } },
      _count: { _all: true },
    }),
  ]);

  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, email: true, phone: true },
  });

  const checkedInParticipantIds = new Set(checkIns.map((c) => c.participantId));
  const signalByUser = new Map(
    signalCounts.map((s) => [s.userId, s._count._all > 0]),
  );

  const participantByUserId = new Map<string, string>();
  for (const p of participants) {
    for (const u of users) {
      if (
        (p.email && u.email && p.email === u.email) ||
        (p.phone && u.phone && p.phone === u.phone)
      ) {
        participantByUserId.set(u.id, p.id);
      }
    }
  }

  return intents.map((intent) => {
    const participantId = participantByUserId.get(intent.userId);
    const checkedIn = participantId
      ? checkedInParticipantIds.has(participantId)
      : false;

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
      hasSignals: signalByUser.get(intent.userId) ?? false,
    };
  });
}

function sortAndLimitCandidates(
  candidates: RecallCandidate[],
  limits: RecallLimits,
): RecallCandidate[] {
  const sorted = [...candidates].sort((a, b) => {
    if (b.recallScore !== a.recallScore) return b.recallScore - a.recallScore;
    return b.dimensions.length - a.dimensions.length;
  });

  if (sorted.length <= limits.max) {
    return sorted.length >= limits.min
      ? sorted
      : sorted.slice(0, Math.min(sorted.length, limits.max));
  }

  return sorted.slice(0, limits.max);
}

export type RecallOptions = {
  limits?: Partial<RecallLimits>;
  vectorLimit?: number;
  minSimilarity?: number;
};

function buildSemanticDimensionHit(similarity: number): MatchDimensionHit {
  const pct = Math.round(similarity * 100);
  return {
    dimension: "semantic_similarity",
    label: `意向语义相近（${pct}%）`,
    detail: String(similarity),
  };
}

function peerToRecallCandidate(
  viewer: ViewerIntentProfile,
  peer: PeerIntentProfile,
  extraDimensions: MatchDimensionHit[] = [],
  semanticSimilarity?: number,
): RecallCandidate {
  const dimensions = [...buildDimensionHits(viewer, peer), ...extraDimensions];
  const recallScore =
    dimensions.length +
    (semanticSimilarity ? Math.round(semanticSimilarity * 5) : 0);

  return {
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
    recallScore,
    semanticSimilarity,
  };
}

export type VectorRecallOptions = {
  limit?: number;
  minSimilarity?: number;
};

/**
 * 向量语义召回：在本活动用户中检索与 viewer 意向 embedding 相近的候选。
 * 不触发 embedding 生成（需报名/批量任务预先写入）。
 */
export async function vectorRecall(
  userId: string,
  eventId: string,
  options?: VectorRecallOptions,
): Promise<Array<{ userId: string; similarity: number; peer: PeerIntentProfile | null }>> {
  const viewerEmbedding = await loadUserEventIntentEmbedding(userId, eventId);
  if (!viewerEmbedding) return [];

  const excluded = await loadExcludedUserIds(userId, eventId);
  const hits = await querySimilarIntentEmbeddings(
    userId,
    eventId,
    viewerEmbedding,
    {
      limit: options?.limit ?? DEFAULT_VECTOR_RECALL_LIMIT,
      minSimilarity: options?.minSimilarity ?? DEFAULT_VECTOR_MIN_SIMILARITY,
      excludedUserIds: excluded,
    },
  );

  if (hits.length === 0) return [];

  const peerMap = new Map(
    (await loadPeerProfiles(eventId, excluded)).map((p) => [p.userId, p]),
  );

  return hits.map((hit) => ({
    userId: hit.userId,
    similarity: hit.similarity,
    peer: peerMap.get(hit.userId) ?? null,
  }));
}

function mergeVectorRecallIntoCandidates(
  viewer: ViewerIntentProfile,
  ruleCandidates: RecallCandidate[],
  vectorHits: Array<{
    userId: string;
    similarity: number;
    peer: PeerIntentProfile | null;
  }>,
): RecallCandidate[] {
  const byUserId = new Map(ruleCandidates.map((c) => [c.userId, c]));

  for (const hit of vectorHits) {
    const peer = hit.peer;
    if (!peer) continue;

    const semanticHit = buildSemanticDimensionHit(hit.similarity);
    const existing = byUserId.get(hit.userId);

    if (existing) {
      if (
        !existing.dimensions.some((d) => d.dimension === "semantic_similarity")
      ) {
        existing.dimensions.push(semanticHit);
        existing.recallScore += 1 + Math.round(hit.similarity * 5);
        existing.semanticSimilarity = hit.similarity;
      }
      continue;
    }

    byUserId.set(
      hit.userId,
      peerToRecallCandidate(viewer, peer, [semanticHit], hit.similarity),
    );
  }

  return [...byUserId.values()];
}

/**
 * 规则 + 向量召回候选用户（向量仅读已有 embedding，现场不触发 embedding LLM）。
 * 返回 30~50 个候选及命中的匹配维度。
 */
export async function recallCandidates(
  userId: string,
  eventId: string,
  options?: RecallOptions,
): Promise<RecallCandidate[]> {
  const limits: RecallLimits = {
    ...DEFAULT_RECALL_LIMITS,
    ...options?.limits,
  };

  const viewer = await loadViewerProfile(userId, eventId);
  if (!viewer) return [];

  const excluded = await loadExcludedUserIds(userId, eventId);
  const peers = await loadPeerProfiles(eventId, excluded);

  const ruleCandidates: RecallCandidate[] = [];

  for (const peer of peers) {
    const dimensions = buildDimensionHits(viewer, peer);

    const hasRuleHit = dimensions.some((d) =>
      [
        "demand_supply",
        "supply_demand",
        "role_complement",
        "shared_topic",
        "shared_industry",
      ].includes(d.dimension),
    );

    if (!hasRuleHit) continue;

    ruleCandidates.push(peerToRecallCandidate(viewer, peer));
  }

  const vectorHits = await vectorRecall(userId, eventId, {
    limit: options?.vectorLimit ?? DEFAULT_VECTOR_RECALL_LIMIT,
    minSimilarity: options?.minSimilarity ?? DEFAULT_VECTOR_MIN_SIMILARITY,
  });

  let result = mergeVectorRecallIntoCandidates(
    viewer,
    ruleCandidates,
    vectorHits,
  );
  result = sortAndLimitCandidates(result, limits);

  if (result.length < limits.min && peers.length > result.length) {
    const picked = new Set(result.map((c) => c.userId));
    const filler = peers
      .filter((p) => !picked.has(p.userId))
      .slice(0, limits.min - result.length)
      .map((peer) => peerToRecallCandidate(viewer, peer));

    result = sortAndLimitCandidates([...result, ...filler], limits);
  }

  return result;
}

export { buildDimensionHits, loadViewerProfile, loadExcludedUserIds };
