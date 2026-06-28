import {
  ConnectionStatus,
  SignalType,
  prisma,
} from "@connectiq/database";
import type { MatchReasonItem } from "@/lib/matchmaking-config";
import { inferIntentFromSignalPayload } from "@/lib/ai/prompts/complement-check";
import {
  DEFAULT_SIGNAL_RANK_WEIGHTS,
  mergeSignalRankWeights,
  type SignalRankWeights,
} from "./config";
import type { RecallCandidate } from "./types";

export type UserBehaviorSnapshot = {
  userId: string;
  boothEntityIds: Set<string>;
  interactionSessionIds: Set<string>;
  signalTypes: Set<SignalType>;
  inferredTopics: string[];
  signalCount: number;
  pastEventIds: Set<string>;
};

export type BehaviorRankAdjustment = {
  delta: number;
  reasons: MatchReasonItem[];
};

function normalizeTag(tag: string): string {
  return tag.trim().toLowerCase();
}

function tagsOverlap(tags: string[], keywords: string[]): boolean {
  if (tags.length === 0 || keywords.length === 0) return false;
  const normalized = tags.map(normalizeTag);
  for (const kw of keywords) {
    const key = normalizeTag(kw);
    if (!key) continue;
    if (normalized.some((t) => t.includes(key) || key.includes(t))) {
      return true;
    }
  }
  return false;
}

function buildSnapshotFromSignals(
  userId: string,
  signals: Array<{
    signalType: SignalType;
    entityId: string | null;
    entityType: string | null;
    inferredIntent: string | null;
    payload: unknown;
  }>,
  pastEventIds: Set<string>,
): UserBehaviorSnapshot {
  const boothEntityIds = new Set<string>();
  const interactionSessionIds = new Set<string>();
  const signalTypes = new Set<SignalType>();
  const inferredTopics: string[] = [];

  for (const s of signals) {
    signalTypes.add(s.signalType);
    const entityTypeNorm = s.entityType?.toLowerCase() ?? "";

    if (
      s.entityId &&
      (entityTypeNorm === "booth" ||
        s.signalType === SignalType.BOOTH_SCAN ||
        s.signalType === SignalType.BOOTH_LEAD_CAPTURED)
    ) {
      boothEntityIds.add(s.entityId);
    }
    if (
      s.entityId &&
      (entityTypeNorm === "interaction" ||
        s.signalType === SignalType.INTERACTION_JOINED)
    ) {
      interactionSessionIds.add(s.entityId);
    }
    if (s.inferredIntent) inferredTopics.push(s.inferredIntent);

    const payload =
      s.payload && typeof s.payload === "object"
        ? (s.payload as Record<string, unknown>)
        : {};
    const inferred = inferIntentFromSignalPayload(s.signalType, payload);
    if (inferred) inferredTopics.push(inferred);
  }

  return {
    userId,
    boothEntityIds,
    interactionSessionIds,
    signalTypes,
    inferredTopics,
    signalCount: signals.length,
    pastEventIds,
  };
}

async function loadPastEventIdsByUser(
  userIds: string[],
  excludeEventId: string,
): Promise<Map<string, Set<string>>> {
  const result = new Map<string, Set<string>>();
  if (userIds.length === 0) return result;

  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, email: true, phone: true },
  });

  const emails = [
    ...new Set(users.map((u) => u.email).filter(Boolean) as string[]),
  ];
  const phones = [
    ...new Set(users.map((u) => u.phone).filter(Boolean) as string[]),
  ];

  if (emails.length === 0 && phones.length === 0) {
    for (const id of userIds) result.set(id, new Set());
    return result;
  }

  const participants = await prisma.participant.findMany({
    where: {
      eventId: { not: excludeEventId },
      OR: [
        ...(emails.length ? [{ email: { in: emails } }] : []),
        ...(phones.length ? [{ phone: { in: phones } }] : []),
      ],
    },
    select: { eventId: true, email: true, phone: true },
  });

  for (const user of users) {
    const eventIds = new Set<string>();
    for (const p of participants) {
      if (user.email && p.email === user.email) eventIds.add(p.eventId);
      if (user.phone && p.phone === user.phone) eventIds.add(p.eventId);
    }
    result.set(user.id, eventIds);
  }

  return result;
}

async function loadBoothNameMap(eventId: string): Promise<Map<string, string>> {
  const booths = await prisma.exhibitorBooth.findMany({
    where: { eventId },
    select: { id: true, name: true, code: true },
  });
  return new Map(booths.map((b) => [b.id, `${b.name} (${b.code})`]));
}

/** 批量加载用户在本活动及跨活动的行为快照 */
export async function loadBehaviorSnapshots(
  eventId: string,
  userIds: string[],
): Promise<Map<string, UserBehaviorSnapshot>> {
  const uniqueIds = [...new Set(userIds)];
  if (uniqueIds.length === 0) return new Map();

  const [signals, pastEventsByUser] = await Promise.all([
    prisma.boothVisitSignal.findMany({
      where: { eventId, userId: { in: uniqueIds } },
      select: {
        userId: true,
        signalType: true,
        entityId: true,
        entityType: true,
        inferredIntent: true,
        payload: true,
      },
      orderBy: { occurredAt: "desc" },
    }),
    loadPastEventIdsByUser(uniqueIds, eventId),
  ]);

  const signalsByUser = new Map<string, typeof signals>();
  for (const s of signals) {
    const list = signalsByUser.get(s.userId) ?? [];
    list.push(s);
    signalsByUser.set(s.userId, list);
  }

  const snapshots = new Map<string, UserBehaviorSnapshot>();
  for (const userId of uniqueIds) {
    snapshots.set(
      userId,
      buildSnapshotFromSignals(
        userId,
        signalsByUser.get(userId) ?? [],
        pastEventsByUser.get(userId) ?? new Set(),
      ),
    );
  }

  return snapshots;
}

async function loadCrossEventConnectionPeers(
  viewerId: string,
  peerIds: string[],
  currentEventId: string,
): Promise<Set<string>> {
  if (peerIds.length === 0) return new Set();

  const rows = await prisma.businessConnection.findMany({
    where: {
      status: ConnectionStatus.ACTIVE,
      eventId: { not: currentEventId },
      OR: [
        { userAId: viewerId, userBId: { in: peerIds } },
        { userBId: viewerId, userAId: { in: peerIds } },
      ],
    },
    select: { userAId: true, userBId: true },
  });

  const connected = new Set<string>();
  for (const row of rows) {
    const peer = row.userAId === viewerId ? row.userBId : row.userAId;
    if (peer) connected.add(peer);
  }
  return connected;
}

export function computeBehaviorAdjustment(
  viewer: UserBehaviorSnapshot,
  peer: UserBehaviorSnapshot,
  candidate: RecallCandidate,
  viewerDemandTags: string[],
  viewerSupplyTags: string[],
  boothNames: Map<string, string>,
  crossEventConnected: boolean,
  weights: SignalRankWeights,
): BehaviorRankAdjustment {
  let delta = 0;
  const reasons: MatchReasonItem[] = [];

  const sharedBooths = [...viewer.boothEntityIds].filter((id) =>
    peer.boothEntityIds.has(id),
  );
  if (sharedBooths.length > 0) {
    const boost = Math.min(
      weights.sharedBoothVisit * sharedBooths.length,
      weights.sharedBoothVisit * 2,
    );
    delta += boost;
    const boothLabel = boothNames.get(sharedBooths[0]!) ?? "同展位";
    reasons.push({
      type: "signal",
      label: `同场都关注过 ${boothLabel}`,
      detail: sharedBooths[0],
    });
  }

  const peerBoothLabels = [...peer.boothEntityIds]
    .map((id) => boothNames.get(id) ?? "")
    .filter(Boolean);
  if (
    peerBoothLabels.length > 0 &&
    tagsOverlap(viewerDemandTags, peerBoothLabels)
  ) {
    delta += weights.peerBoothAlignsDemand;
    reasons.push({
      type: "signal",
      label: "对方停留展位与你的需求方向一致",
    });
  }

  if (
    tagsOverlap(viewerSupplyTags, peer.inferredTopics) ||
    tagsOverlap(viewerDemandTags, peer.inferredTopics)
  ) {
    delta += weights.viewerPeerIntentOverlap;
    reasons.push({
      type: "signal",
      label: "现场行为意向与彼此标签呼应",
    });
  }

  const interactionTypes: SignalType[] = [
    SignalType.INTERACTION_JOINED,
    SignalType.POLL_ANSWERED,
    SignalType.QNA_ASKED,
    SignalType.QNA_UPVOTED,
  ];
  if (interactionTypes.some((t) => peer.signalTypes.has(t))) {
    delta += weights.peerInteractionActive;
    reasons.push({
      type: "signal",
      label: "对方参与了现场互动",
    });
  }

  if (viewer.signalCount > 0 && peer.signalCount > 0) {
    delta += weights.bothOnSiteActive;
  }

  const sharedPastEvents = [...viewer.pastEventIds].filter((id) =>
    peer.pastEventIds.has(id),
  );
  if (sharedPastEvents.length > 0) {
    const boost = Math.min(
      weights.crossEventCoAttendance * sharedPastEvents.length,
      weights.crossEventCoAttendance * 2,
    );
    delta += boost;
    reasons.push({
      type: "signal",
      label: `跨活动同行（${sharedPastEvents.length} 场）`,
    });
  }

  if (crossEventConnected) {
    delta += weights.crossEventPriorConnection;
    reasons.push({
      type: "signal",
      label: "曾在其他活动建立过连接",
    });
  }

  if (
    peer.signalCount === 0 &&
    candidate.dimensions.some((d) => d.dimension === "co_presence")
  ) {
    delta += weights.peerLowEngagement;
    reasons.push({
      type: "signal",
      label: "对方现场活跃度较低",
    });
  }

  return { delta, reasons };
}

export async function applyBehaviorSignalRanking(
  viewerId: string,
  eventId: string,
  candidates: RecallCandidate[],
  viewerDemandTags: string[],
  viewerSupplyTags: string[],
  weightsOverride?: Partial<SignalRankWeights>,
): Promise<Map<string, BehaviorRankAdjustment>> {
  const weights = mergeSignalRankWeights(weightsOverride);
  const userIds = [viewerId, ...candidates.map((c) => c.userId)];

  const [snapshots, boothNames, crossEventPeers] = await Promise.all([
    loadBehaviorSnapshots(eventId, userIds),
    loadBoothNameMap(eventId),
    loadCrossEventConnectionPeers(
      viewerId,
      candidates.map((c) => c.userId),
      eventId,
    ),
  ]);

  const viewer = snapshots.get(viewerId);
  if (!viewer) return new Map();

  const adjustments = new Map<string, BehaviorRankAdjustment>();

  for (const candidate of candidates) {
    const peer = snapshots.get(candidate.userId);
    if (!peer) continue;

    adjustments.set(
      candidate.userId,
      computeBehaviorAdjustment(
        viewer,
        peer,
        candidate,
        viewerDemandTags,
        viewerSupplyTags,
        boothNames,
        crossEventPeers.has(candidate.userId),
        weights,
      ),
    );
  }

  return adjustments;
}
