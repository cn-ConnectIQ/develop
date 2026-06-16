import { prisma } from "@connectiq/database";
import { ErrorCode } from "@connectiq/types";
import { ApiError } from "@/lib/api-auth";
import { findParticipantForUser } from "@/lib/interaction/participant-user";

type ParticipantLite = {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
};

export type ApiSnPairItem = {
  pair_id: string;
  round: number;
  score: number;
  connected: boolean;
  counterparty: {
    user_id: string;
    name: string;
    company?: string;
    avatar_url?: string;
  };
};

export type ApiSnMyHistory = {
  total_rounds: number;
  total_pairs: number;
  connected: number;
  rounds: Array<{
    round: number;
    pairs: ApiSnPairItem[];
  }>;
};

export type ApiEventSnSummary = {
  total_rounds: number;
  total_pairs: number;
  connected: number;
};

export type ApiProfileEventHistoryItem = {
  event_id: string;
  event_name: string;
  starts_at?: string;
  city?: string;
  sn_summary?: ApiEventSnSummary;
};

function pairScore(ratingA: number | null, ratingB: number | null): number {
  const scores: number[] = [];
  if (ratingA != null) scores.push(ratingA);
  if (ratingB != null) scores.push(ratingB);
  if (scores.length === 0) return 80;
  const avg = scores.reduce((sum, n) => sum + n, 0) / scores.length;
  return Math.round(avg * 20);
}

async function resolveUserIdForParticipant(
  participant: ParticipantLite,
): Promise<string> {
  const or: Array<{ email?: string; phone?: string }> = [];
  if (participant.email) or.push({ email: participant.email });
  if (participant.phone) or.push({ phone: participant.phone });

  if (or.length > 0) {
    const user = await prisma.user.findFirst({
      where: { OR: or },
      select: { id: true },
    });
    if (user) return user.id;
  }

  return `participant-${participant.id}`;
}

async function mapPairRow(
  pair: {
    id: string;
    round: number;
    ratingA: number | null;
    ratingB: number | null;
    connectionEstablished: boolean;
    participantA: ParticipantLite;
    participantB: ParticipantLite;
  },
  myParticipantId: string,
): Promise<ApiSnPairItem> {
  const isA = pair.participantA.id === myParticipantId;
  const counterparty = isA ? pair.participantB : pair.participantA;
  const myRating = isA ? pair.ratingA : pair.ratingB;
  const theirRating = isA ? pair.ratingB : pair.ratingA;
  const userId = await resolveUserIdForParticipant(counterparty);

  return {
    pair_id: pair.id,
    round: pair.round,
    score: pairScore(myRating, theirRating),
    connected: pair.connectionEstablished,
    counterparty: {
      user_id: userId,
      name: counterparty.name,
      company: counterparty.company ?? undefined,
    },
  };
}

export async function getMySnPairHistory(
  eventId: string,
  userId: string,
): Promise<ApiSnMyHistory> {
  const participant = await findParticipantForUser(eventId, userId);
  if (!participant) {
    return { total_rounds: 0, total_pairs: 0, connected: 0, rounds: [] };
  }

  const pairs = await prisma.snPair.findMany({
    where: {
      OR: [
        { participantAId: participant.id },
        { participantBId: participant.id },
      ],
      session: { eventId },
    },
    include: {
      participantA: {
        select: { id: true, name: true, company: true, email: true, phone: true },
      },
      participantB: {
        select: { id: true, name: true, company: true, email: true, phone: true },
      },
    },
    orderBy: [{ round: "asc" }, { createdAt: "asc" }],
  });

  const mapped = await Promise.all(
    pairs.map((pair) => mapPairRow(pair, participant.id)),
  );

  const roundMap = new Map<number, ApiSnPairItem[]>();
  for (const item of mapped) {
    const list = roundMap.get(item.round) ?? [];
    list.push(item);
    roundMap.set(item.round, list);
  }

  const rounds = [...roundMap.entries()]
    .sort(([a], [b]) => a - b)
    .map(([round, roundPairs]) => ({ round, pairs: roundPairs }));

  return {
    total_rounds: rounds.length,
    total_pairs: mapped.length,
    connected: mapped.filter((p) => p.connected).length,
    rounds,
  };
}

async function summarizeSnForParticipant(
  eventId: string,
  participantId: string,
): Promise<ApiEventSnSummary | null> {
  const pairs = await prisma.snPair.findMany({
    where: {
      OR: [{ participantAId: participantId }, { participantBId: participantId }],
      session: { eventId },
    },
    select: { round: true, connectionEstablished: true },
  });

  if (pairs.length === 0) return null;

  const rounds = new Set(pairs.map((p) => p.round));
  return {
    total_rounds: rounds.size,
    total_pairs: pairs.length,
    connected: pairs.filter((p) => p.connectionEstablished).length,
  };
}

export async function listMyEventHistoryWithSn(
  userId: string,
): Promise<ApiProfileEventHistoryItem[]> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, phone: true },
  });
  if (!user) {
    throw new ApiError("用户不存在", ErrorCode.NOT_FOUND, 404);
  }

  const or: Array<{ email?: string; phone?: string }> = [];
  if (user.email) or.push({ email: user.email });
  if (user.phone) or.push({ phone: user.phone });

  if (or.length === 0) return [];

  const participants = await prisma.participant.findMany({
    where: { OR: or },
    select: {
      id: true,
      eventId: true,
      event: {
        select: {
          id: true,
          name: true,
          startDate: true,
          location: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const seen = new Set<string>();
  const items: ApiProfileEventHistoryItem[] = [];

  for (const row of participants) {
    if (seen.has(row.eventId)) continue;
    seen.add(row.eventId);

    const snSummary = await summarizeSnForParticipant(row.eventId, row.id);
    items.push({
      event_id: row.event.id,
      event_name: row.event.name,
      starts_at: row.event.startDate?.toISOString(),
      city: row.event.location ?? undefined,
      sn_summary: snSummary ?? undefined,
    });
  }

  return items.sort((a, b) => {
    const ta = a.starts_at ? Date.parse(a.starts_at) : 0;
    const tb = b.starts_at ? Date.parse(b.starts_at) : 0;
    return tb - ta;
  });
}
