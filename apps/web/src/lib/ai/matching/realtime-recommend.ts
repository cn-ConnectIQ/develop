import { BoothStatus, SignalType, prisma } from "@connectiq/database";
import { ROLE_COMPLEMENT_PAIRS } from "@/lib/ai/matching/config";
import {
  buildDimensionHits,
  loadExcludedUserIds,
  loadViewerProfile,
} from "@/lib/ai/matching/recall";
import type { PeerIntentProfile, RecallCandidate } from "@/lib/ai/matching/types";
import {
  REALTIME_PRESENCE_WINDOW_MS,
  extractRealtimeTopics,
  mergeStaticIntentTopics,
  topicMatchesText,
  type RealtimeTopic,
} from "@/lib/ai/matching/realtime-interest";
import { formatRankedReason, rankCandidates } from "@/lib/ai/matching/rank";
import { inferIntentFromSignalPayload } from "@/lib/ai/prompts/complement-check";

export const DEFAULT_REALTIME_RECOMMEND_LIMIT = 12;
export const DEFAULT_REALTIME_PEOPLE_LIMIT = 6;
export const DEFAULT_REALTIME_BOOTH_LIMIT = 4;

export type RealtimeRecommendationType =
  | "person"
  | "booth"
  | "session"
  | "insight";

export type RealtimeRecommendationItem = {
  type: RealtimeRecommendationType;
  priority: number;
  title: string;
  reason: string;
  topic?: string;
  triggeredBy?: string;
  matchScore?: number;
  userId?: string;
  name?: string;
  company?: string;
  userTitle?: string;
  boothId?: string;
  boothCode?: string;
  boothName?: string;
  hall?: string;
  sessionId?: string;
  sessionTitle?: string;
  room?: string;
  targetCustomerCount?: number;
  liveNow?: boolean;
};

export type RealtimeRecommendationsResult = {
  updatedAt: string;
  realtimeTopics: RealtimeTopic[];
  headline: string | null;
  items: RealtimeRecommendationItem[];
};

type BoothRow = {
  id: string;
  name: string;
  code: string;
  hallLabel: string | null;
  companyOrg: { name: string; bio: string | null; industry: string | null };
  hall: { name: string } | null;
};

function normalizeTag(tag: string): string {
  return tag.trim().toLowerCase();
}

function tagsOverlap(left: string[], right: string[]): boolean {
  for (const a of left) {
    const key = normalizeTag(a);
    if (!key) continue;
    for (const b of right) {
      const other = normalizeTag(b);
      if (!other) continue;
      if (key.includes(other) || other.includes(key)) return true;
    }
  }
  return false;
}

function isRoleComplement(roleA: string | null, roleB: string | null): boolean {
  if (!roleA || !roleB) return false;
  return ROLE_COMPLEMENT_PAIRS.some(
    ([x, y]) => x === roleA.trim() && y === roleB.trim(),
  );
}

function boothSearchText(booth: BoothRow): string {
  return [
    booth.name,
    booth.code,
    booth.companyOrg.name,
    booth.companyOrg.bio ?? "",
    booth.companyOrg.industry ?? "",
  ]
    .join(" ")
    .toLowerCase();
}

async function loadPeerProfilesForEvent(
  eventId: string,
  excluded: Set<string>,
): Promise<PeerIntentProfile[]> {
  const intents = await prisma.userEventIntent.findMany({
    where: { eventId, userId: { notIn: [...excluded] } },
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
  const signalCounts = await prisma.boothVisitSignal.groupBy({
    by: ["userId"],
    where: { eventId, userId: { in: userIds } },
    _count: { _all: true },
  });
  const signalByUser = new Map(
    signalCounts.map((s) => [s.userId, s._count._all > 0]),
  );

  return intents.map((intent) => ({
    userId: intent.userId,
    name: intent.user.name,
    company: intent.user.profile?.company ?? null,
    role: intent.role,
    industry: intent.industry ?? intent.user.profile?.industry ?? null,
    region: intent.region,
    supplyTags: intent.supplyTags,
    demandTags: intent.demandTags,
    topics: intent.topics,
    checkedIn: true,
    hasSignals: signalByUser.get(intent.userId) ?? false,
  }));
}

async function countTargetCustomersAtBooth(
  boothId: string,
  eventId: string,
  viewerDemandTags: string[],
  viewerRole: string | null,
  since: Date,
  excludeUserId: string,
): Promise<number> {
  const presenceSignals = await prisma.boothVisitSignal.findMany({
    where: {
      eventId,
      entityId: boothId,
      occurredAt: { gte: since },
      userId: { not: excludeUserId },
      signalType: {
        in: [SignalType.BOOTH_SCAN, SignalType.BOOTH_LEAD_CAPTURED],
      },
    },
    select: { userId: true },
    distinct: ["userId"],
  });

  const userIds = presenceSignals.map((s) => s.userId);
  if (userIds.length === 0) return 0;

  const intents = await prisma.userEventIntent.findMany({
    where: { eventId, userId: { in: userIds } },
    select: { userId: true, supplyTags: true, role: true },
  });

  let count = 0;
  for (const intent of intents) {
    if (tagsOverlap(viewerDemandTags, intent.supplyTags)) {
      count++;
      continue;
    }
    if (isRoleComplement(viewerRole, intent.role)) {
      count++;
    }
  }
  return count;
}

async function findBoothRecommendations(
  eventId: string,
  viewerId: string,
  topics: RealtimeTopic[],
  viewerDemandTags: string[],
  viewerRole: string | null,
  limit: number,
): Promise<RealtimeRecommendationItem[]> {
  if (topics.length === 0) return [];

  const booths = await prisma.exhibitorBooth.findMany({
    where: { eventId, status: BoothStatus.OCCUPIED },
    select: {
      id: true,
      name: true,
      code: true,
      hallLabel: true,
      companyOrg: { select: { name: true, bio: true, industry: true } },
      hall: { select: { name: true } },
    },
  });

  const presenceSince = new Date(Date.now() - REALTIME_PRESENCE_WINDOW_MS);

  const activeSessions = await prisma.interactionSession.findMany({
    where: { eventId, isActive: true, boothId: { not: null } },
    select: { boothId: true, name: true },
  });
  const liveBoothIds = new Set(
    activeSessions.map((s) => s.boothId).filter(Boolean) as string[],
  );
  const sessionNameByBooth = new Map<string, string>();
  for (const s of activeSessions) {
    if (s.boothId) sessionNameByBooth.set(s.boothId, s.name);
  }

  const scored: RealtimeRecommendationItem[] = [];

  for (const booth of booths) {
    const text = boothSearchText(booth);
    let bestTopic: RealtimeTopic | null = null;
    let matchScore = 0;

    for (const topic of topics) {
      if (topicMatchesText(topic.topic, text)) {
        const score = topic.weight * 100;
        if (score > matchScore) {
          matchScore = score;
          bestTopic = topic;
        }
      }
    }

    if (!bestTopic) continue;

    const liveNow = liveBoothIds.has(booth.id);
    const sessionName = sessionNameByBooth.get(booth.id);
    const targetCustomerCount = await countTargetCustomersAtBooth(
      booth.id,
      eventId,
      viewerDemandTags,
      viewerRole,
      presenceSince,
      viewerId,
    );

    let priority = Math.round(matchScore);
    if (liveNow) priority += 25;
    if (targetCustomerCount > 0) priority += 15 + targetCustomerCount * 5;

    const hall = booth.hallLabel ?? booth.hall?.name ?? undefined;
    const reason = liveNow
      ? sessionName
        ? `正在讲解「${sessionName}」，与${bestTopic.trigger}的「${bestTopic.topic}」相关`
        : `正在讲解与「${bestTopic.topic}」相关的议题`
      : `展位主题与${bestTopic.trigger}的「${bestTopic.topic}」高度相关`;

    scored.push({
      type: "booth",
      priority,
      title: `${booth.code} 号展台 · ${booth.companyOrg.name}`,
      reason,
      topic: bestTopic.topic,
      triggeredBy: bestTopic.trigger,
      boothId: booth.id,
      boothCode: booth.code,
      boothName: booth.name,
      hall,
      targetCustomerCount,
      liveNow,
      matchScore: Math.min(99, priority),
    });
  }

  return scored.sort((a, b) => b.priority - a.priority).slice(0, limit);
}

async function findSessionRecommendations(
  eventId: string,
  topics: RealtimeTopic[],
  limit: number,
): Promise<RealtimeRecommendationItem[]> {
  if (topics.length === 0) return [];

  const now = new Date();
  const sessions = await prisma.session.findMany({
    where: {
      eventId,
      startTime: { lte: now },
      OR: [{ endTime: null }, { endTime: { gte: now } }],
    },
    select: {
      id: true,
      title: true,
      room: true,
    },
    take: 30,
  });

  const scored: RealtimeRecommendationItem[] = [];

  for (const session of sessions) {
    for (const topic of topics) {
      if (!topicMatchesText(topic.topic, session.title)) continue;

      scored.push({
        type: "session",
        priority: Math.round(70 + topic.weight * 30),
        title: session.title,
        reason: `正在进行，与${topic.trigger}的「${topic.topic}」相关`,
        topic: topic.topic,
        triggeredBy: topic.trigger,
        sessionId: session.id,
        sessionTitle: session.title,
        room: session.room ?? undefined,
        liveNow: true,
        matchScore: Math.min(99, Math.round(75 + topic.weight * 20)),
      });
      break;
    }
  }

  return scored.sort((a, b) => b.priority - a.priority).slice(0, limit);
}

async function findPeopleWithSharedRealtimeInterest(
  eventId: string,
  viewerId: string,
  topics: RealtimeTopic[],
  excluded: Set<string>,
  limit: number,
): Promise<
  Array<{ userId: string; score: number; reason: string; topic: string }>
> {
  if (topics.length === 0) return [];

  const since = new Date(Date.now() - REALTIME_PRESENCE_WINDOW_MS);

  const peerSignals = await prisma.boothVisitSignal.findMany({
    where: {
      eventId,
      occurredAt: { gte: since },
      userId: { notIn: [...excluded] },
    },
    orderBy: { occurredAt: "desc" },
    take: 200,
    select: {
      userId: true,
      signalType: true,
      inferredIntent: true,
      payload: true,
      entityId: true,
    },
  });

  const boothIds = [
    ...new Set(
      peerSignals.map((s) => s.entityId).filter(Boolean) as string[],
    ),
  ];
  const viewerBoothSignals = await prisma.boothVisitSignal.findMany({
    where: {
      eventId,
      userId: viewerId,
      occurredAt: { gte: since },
      entityId: { not: null },
    },
    select: { entityId: true },
  });
  const viewerBoothIds = new Set(
    viewerBoothSignals.map((s) => s.entityId).filter(Boolean) as string[],
  );

  const booths =
    boothIds.length > 0
      ? await prisma.exhibitorBooth.findMany({
          where: { id: { in: boothIds } },
          select: { id: true, name: true, code: true },
        })
      : [];
  const boothNames = new Map(
    booths.map((b) => [b.id, `${b.name} (${b.code})`]),
  );

  const userScores = new Map<
    string,
    { score: number; reason: string; topic: string }
  >();

  for (const signal of peerSignals) {
    const payload =
      signal.payload && typeof signal.payload === "object"
        ? (signal.payload as Record<string, unknown>)
        : {};
    const inferred = inferIntentFromSignalPayload(signal.signalType, payload);
    const signalTopics: string[] = [];
    if (inferred) signalTopics.push(inferred);
    if (signal.inferredIntent) signalTopics.push(signal.inferredIntent);
    if (signal.entityId && boothNames.has(signal.entityId)) {
      signalTopics.push(boothNames.get(signal.entityId)!);
    }

    for (const topic of topics) {
      const matched = signalTopics.some((st) =>
        topicMatchesText(topic.topic, st),
      );
      if (!matched) continue;

      const coLocated =
        signal.entityId && viewerBoothIds.has(signal.entityId);
      const score = Math.round(50 + topic.weight * 40 + (coLocated ? 20 : 0));
      const reason = coLocated
        ? `同样关注「${topic.topic}」，且正在同一展位附近`
        : `同样刚关注「${topic.topic}」`;

      const existing = userScores.get(signal.userId);
      if (!existing || score > existing.score) {
        userScores.set(signal.userId, {
          score,
          reason,
          topic: topic.topic,
        });
      }
    }
  }

  return [...userScores.entries()]
    .map(([userId, meta]) => ({ userId, ...meta }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

async function findPeopleRecommendations(
  eventId: string,
  viewerId: string,
  topics: RealtimeTopic[],
  excluded: Set<string>,
  limit: number,
): Promise<RealtimeRecommendationItem[]> {
  const viewer = await loadViewerProfile(viewerId, eventId);
  if (!viewer) return [];

  const augmentedTopics = [
    ...viewer.topics,
    ...viewer.demandTags,
    ...topics.map((t) => t.topic),
  ];

  const augmentedViewer = {
    ...viewer,
    topics: [...new Set(augmentedTopics)],
  };

  const peers = await loadPeerProfilesForEvent(eventId, excluded);
  const sharedInterest = await findPeopleWithSharedRealtimeInterest(
    eventId,
    viewerId,
    topics,
    excluded,
    limit * 2,
  );
  const sharedMap = new Map(sharedInterest.map((p) => [p.userId, p]));

  const candidates: RecallCandidate[] = [];

  for (const peer of peers) {
    const dimensions = buildDimensionHits(augmentedViewer, peer);
    const shared = sharedMap.get(peer.userId);

    if (dimensions.length === 0 && !shared) continue;

    candidates.push({
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
      recallScore: dimensions.length + (shared ? 2 : 0),
    });
  }

  const ranked = await rankCandidates(viewerId, candidates, {
    eventId,
    topN: limit,
    enableLlmComplement: false,
  });

  return ranked.map((person) => {
    const shared = sharedMap.get(person.userId);
    const reason = shared
      ? shared.reason
      : formatRankedReason(person) || "现场意向与你不谋而合";

    return {
      type: "person" as const,
      priority: Math.round(person.score + (shared ? 10 : 0)),
      title: person.name,
      reason,
      topic: shared?.topic ?? topics[0]?.topic,
      triggeredBy: topics[0]?.trigger,
      matchScore: person.score,
      userId: person.userId,
      name: person.name,
      company: person.company ?? undefined,
      userTitle: person.role ?? undefined,
    };
  });
}

function buildHeadline(
  topTopic: RealtimeTopic | undefined,
  topBooth: RealtimeRecommendationItem | undefined,
): string | null {
  if (!topTopic) return null;

  if (
    topBooth?.boothCode &&
    topBooth.liveNow &&
    (topBooth.targetCustomerCount ?? 0) > 0
  ) {
    return `你${topTopic.trigger}「${topTopic.topic}」，${topBooth.boothCode} 号展台正在讲，且有 ${topBooth.targetCustomerCount} 位目标客户在场`;
  }

  if (topBooth?.boothCode && topBooth.liveNow) {
    return `你${topTopic.trigger}「${topTopic.topic}」，${topBooth.boothCode} 号展台正在讲解相关议题`;
  }

  if (topBooth?.boothCode) {
    return `你${topTopic.trigger}「${topTopic.topic}」，推荐前往 ${topBooth.boothCode} 号展台`;
  }

  return `你${topTopic.trigger}「${topTopic.topic}」，为你更新了现场推荐`;
}

export type GetRealtimeRecommendationsOptions = {
  itemLimit?: number;
  peopleLimit?: number;
  boothLimit?: number;
};

/**
 * 现场行为驱动的动态推荐（超越静态会前匹配）。
 * 行为事件流 → 实时兴趣 → 推人 / 展台 / 议程。
 */
export async function getRealtimeRecommendations(
  viewerId: string,
  eventId: string,
  options?: GetRealtimeRecommendationsOptions,
): Promise<RealtimeRecommendationsResult> {
  const itemLimit = options?.itemLimit ?? DEFAULT_REALTIME_RECOMMEND_LIMIT;
  const peopleLimit = options?.peopleLimit ?? DEFAULT_REALTIME_PEOPLE_LIMIT;
  const boothLimit = options?.boothLimit ?? DEFAULT_REALTIME_BOOTH_LIMIT;

  const [viewerIntent, excluded, realtimeTopics] = await Promise.all([
    prisma.userEventIntent.findUnique({
      where: { userId_eventId: { userId: viewerId, eventId } },
      select: {
        demandTags: true,
        supplyTags: true,
        topics: true,
        role: true,
      },
    }),
    loadExcludedUserIds(viewerId, eventId),
    extractRealtimeTopics(viewerId, eventId),
  ]);

  const topics = mergeStaticIntentTopics(realtimeTopics, [
    ...(viewerIntent?.demandTags ?? []),
    ...(viewerIntent?.topics ?? []),
  ]).slice(0, 8);

  const demandTags = viewerIntent?.demandTags ?? [];
  const viewerRole = viewerIntent?.role ?? null;

  const [booths, sessions, people] = await Promise.all([
    findBoothRecommendations(
      eventId,
      viewerId,
      topics,
      demandTags,
      viewerRole,
      boothLimit,
    ),
    findSessionRecommendations(eventId, topics, 3),
    findPeopleRecommendations(
      eventId,
      viewerId,
      topics,
      excluded,
      peopleLimit,
    ),
  ]);

  const topBooth = booths[0];
  const headline = buildHeadline(topics[0], topBooth);

  const items = [...booths, ...sessions, ...people]
    .sort((a, b) => b.priority - a.priority)
    .slice(0, itemLimit);

  if (headline && items.length > 0 && items[0]?.type !== "insight") {
    items.unshift({
      type: "insight",
      priority: 1000,
      title: headline,
      reason: topics[0]?.trigger ?? "现场动态",
      topic: topics[0]?.topic,
      triggeredBy: topics[0]?.trigger,
    });
  }

  return {
    updatedAt: new Date().toISOString(),
    realtimeTopics: realtimeTopics.slice(0, 5),
    headline,
    items,
  };
}
