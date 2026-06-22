import {
  AiMatchAction,
  AiMatchScenario,
  ConnectionStatus,
  FeedItemType,
  SignalType,
  prisma,
} from "@connectiq/database";
import { parseIntentTags } from "@/lib/user-me-service";

const MATCH_WINDOW_MS = 30 * 60 * 1000;
const TOP_MATCHES = 20;
const HIGH_SCORE_FEED_THRESHOLD = 90;

type UserCandidate = {
  id: string;
  name: string;
  company: string | null;
  supplyTags: Set<string>;
  demandTags: Set<string>;
  signalBoostTags: Set<string>;
};

function normalizeTag(tag: string) {
  return tag.trim().toLowerCase();
}

function inferIntentFromSignal(
  signalType: SignalType,
  payload: Record<string, unknown>,
): { intent: string | null; confidence: number } {
  switch (signalType) {
    case SignalType.POLL_ANSWERED: {
      const options = payload.selected_options;
      if (Array.isArray(options) && options.length > 0) {
        const text = String(options[0]);
        return { intent: text, confidence: 0.75 };
      }
      const title = payload.poll_title;
      if (typeof title === "string") {
        return { intent: title, confidence: 0.6 };
      }
      break;
    }
    case SignalType.QNA_ASKED: {
      const q = payload.question_text;
      if (typeof q === "string" && q.trim()) {
        return { intent: q.trim().slice(0, 80), confidence: 0.7 };
      }
      break;
    }
    case SignalType.BOOTH_LEAD_CAPTURED: {
      const grade = payload.intent_level;
      return {
        intent: typeof grade === "string" ? `${grade}级采购意向` : "展位留资",
        confidence: 0.85,
      };
    }
    case SignalType.BOOTH_SCAN:
      return { intent: "展位参观", confidence: 0.5 };
    default:
      break;
  }
  return { intent: null, confidence: 0 };
}

async function enrichSignalsWithInference(signalIds: string[]) {
  if (signalIds.length === 0) return;

  const signals = await prisma.boothVisitSignal.findMany({
    where: { id: { in: signalIds }, inferredIntent: null },
  });

  await Promise.all(
    signals.map(async (signal) => {
      const payload =
        signal.payload && typeof signal.payload === "object"
          ? (signal.payload as Record<string, unknown>)
          : {};
      const { intent, confidence } = inferIntentFromSignal(
        signal.signalType,
        payload,
      );
      if (!intent) return;
      await prisma.boothVisitSignal.update({
        where: { id: signal.id },
        data: { inferredIntent: intent, intentConfidence: confidence },
      });
    }),
  );
}

async function loadEventCandidates(eventId: string): Promise<UserCandidate[]> {
  const participants = await prisma.participant.findMany({
    where: { eventId, checkIns: { some: { eventId } } },
    select: { email: true, phone: true },
  });

  const emails = [...new Set(participants.map((p) => p.email).filter(Boolean) as string[])];
  const phones = [...new Set(participants.map((p) => p.phone).filter(Boolean) as string[])];

  if (emails.length === 0 && phones.length === 0) return [];

  const users = await prisma.user.findMany({
    where: {
      OR: [
        ...(emails.length ? [{ email: { in: emails } }] : []),
        ...(phones.length ? [{ phone: { in: phones } }] : []),
      ],
    },
    select: {
      id: true,
      name: true,
      profile: { select: { company: true, intentTags: true } },
    },
  });

  const signals = await prisma.boothVisitSignal.findMany({
    where: { eventId },
    select: { userId: true, inferredIntent: true, signalType: true, payload: true },
  });

  const signalTagsByUser = new Map<string, Set<string>>();
  for (const s of signals) {
    const tags = signalTagsByUser.get(s.userId) ?? new Set<string>();
    if (s.inferredIntent) tags.add(normalizeTag(s.inferredIntent));
    const payload =
      s.payload && typeof s.payload === "object"
        ? (s.payload as Record<string, unknown>)
        : {};
    const inferred = inferIntentFromSignal(s.signalType, payload);
    if (inferred.intent) tags.add(normalizeTag(inferred.intent));
    signalTagsByUser.set(s.userId, tags);
  }

  return users.map((user) => {
    const intents = parseIntentTags(user.profile?.intentTags);
    const supplyTags = new Set<string>();
    const demandTags = new Set<string>();
    for (const intent of intents) {
      const key = normalizeTag(intent.label);
      if (intent.type === "SUPPLY") supplyTags.add(key);
      else demandTags.add(key);
    }
    return {
      id: user.id,
      name: user.name,
      company: user.profile?.company ?? null,
      supplyTags,
      demandTags,
      signalBoostTags: signalTagsByUser.get(user.id) ?? new Set(),
    };
  });
}

function scorePair(a: UserCandidate, b: UserCandidate): { score: number; reason: string } {
  let score = 40;
  const reasons: string[] = [];

  for (const tag of a.demandTags) {
    if (b.supplyTags.has(tag)) {
      score += 25;
      reasons.push(`需求「${tag}」与供给匹配`);
    }
  }
  for (const tag of b.demandTags) {
    if (a.supplyTags.has(tag)) {
      score += 20;
      reasons.push(`双向供需互补`);
      break;
    }
  }

  for (const tag of a.signalBoostTags) {
    if (b.supplyTags.has(tag) || b.demandTags.has(tag)) {
      score += 15;
      reasons.push(`行为信号强化：${tag}`);
    }
  }

  if (a.company && b.company && a.company !== b.company) {
    score += 5;
  }

  score = Math.min(100, score);
  return {
    score,
    reason: reasons.length > 0 ? reasons.slice(0, 2).join("；") : "同行业参会者，存在合作潜力",
  };
}

async function getKnownPeerIds(userId: string) {
  const connections = await prisma.businessConnection.findMany({
    where: {
      status: ConnectionStatus.ACTIVE,
      OR: [{ userAId: userId }, { userBId: userId }],
    },
    select: { userAId: true, userBId: true },
  });
  const known = new Set<string>();
  for (const c of connections) {
    if (c.userAId && c.userAId !== userId) known.add(c.userAId);
    if (c.userBId && c.userBId !== userId) known.add(c.userBId);
  }
  return known;
}

export async function computeUserMatches(
  eventId: string,
  userId: string,
  candidates: UserCandidate[],
) {
  const user = candidates.find((c) => c.id === userId);
  if (!user) return [];

  const known = await getKnownPeerIds(userId);
  const matches: Array<{
    userBId: string;
    userBName: string;
    userBCompany: string | null;
    score: number;
    reason: string;
  }> = [];

  for (const peer of candidates) {
    if (peer.id === userId || known.has(peer.id)) continue;
    const { score, reason } = scorePair(user, peer);
    if (score < 50) continue;
    matches.push({
      userBId: peer.id,
      userBName: peer.name,
      userBCompany: peer.company,
      score,
      reason,
    });
  }

  return matches.sort((a, b) => b.score - a.score).slice(0, TOP_MATCHES);
}

export async function refreshUserMatchResults(
  eventId: string,
  userId: string,
  candidates: UserCandidate[],
) {
  const user = candidates.find((c) => c.id === userId);
  if (!user) return { updated: 0, highScoreFeeds: 0 };

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { name: true },
  });

  const newMatches = await computeUserMatches(eventId, userId, candidates);
  const existing = await prisma.aiMatchResult.findMany({
    where: { eventId, userAName: user.name },
    select: { userBName: true, score: true },
  });
  const existingMap = new Map(existing.map((r) => [r.userBName, r.score]));

  await prisma.aiMatchResult.deleteMany({
    where: { eventId, userAName: user.name },
  });

  if (newMatches.length === 0) {
    return { updated: 0, highScoreFeeds: 0 };
  }

  await prisma.aiMatchResult.createMany({
    data: newMatches.map((m) => ({
      eventId,
      userAName: user.name,
      userACompany: user.company,
      userBName: m.userBName,
      userBCompany: m.userBCompany,
      score: m.score,
      reason: m.reason,
      scenario: AiMatchScenario.PARTICIPANT_PEER,
      action: AiMatchAction.PENDING,
    })),
  });

  let highScoreFeeds = 0;
  for (const match of newMatches) {
    const prevScore = existingMap.get(match.userBName) ?? 0;
    if (match.score > HIGH_SCORE_FEED_THRESHOLD && match.score > prevScore) {
      await prisma.feedItem.create({
        data: {
          userId,
          eventId,
          type: FeedItemType.MATCH,
          aiScore: Math.min(5, Math.round(match.score / 20)),
          triggerReason: "发现新的高匹配商机",
          content: JSON.stringify({
            match_user_id: match.userBId,
            match_user_name: match.userBName,
            score: match.score,
            reason: match.reason,
            event_name: event?.name,
          }),
        },
      });
      highScoreFeeds++;
    }
  }

  return { updated: newMatches.length, highScoreFeeds };
}

export async function runMatchingUpdateForLiveEvents() {
  const since = new Date(Date.now() - MATCH_WINDOW_MS);
  const liveEvents = await prisma.event.findMany({
    where: { status: "LIVE" },
    select: { id: true },
  });

  const summary: Array<{
    eventId: string;
    usersUpdated: number;
    feedsCreated: number;
  }> = [];

  for (const event of liveEvents) {
    const recentSignals = await prisma.boothVisitSignal.findMany({
      where: { eventId: event.id, occurredAt: { gte: since } },
      select: { id: true, userId: true },
    });

    if (recentSignals.length === 0) continue;

    await enrichSignalsWithInference(recentSignals.map((s) => s.id));

    const userIds = [...new Set(recentSignals.map((s) => s.userId))];
    const candidates = await loadEventCandidates(event.id);

    let usersUpdated = 0;
    let feedsCreated = 0;
    for (const userId of userIds) {
      const result = await refreshUserMatchResults(event.id, userId, candidates);
      if (result.updated > 0) usersUpdated++;
      feedsCreated += result.highScoreFeeds;
    }

    summary.push({ eventId: event.id, usersUpdated, feedsCreated });
  }

  return summary;
}
