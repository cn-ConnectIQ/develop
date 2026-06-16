import { SnSessionStatus, prisma } from "@connectiq/database";
import { ErrorCode } from "@connectiq/types";
import { ApiError } from "@/lib/api-auth";
import { findParticipantForUser } from "@/lib/interaction/participant-user";

const DEFAULT_ROUND_SECONDS = 300;
const DEFAULT_BREAK_SECONDS = 120;

type ParticipantLite = {
  id: string;
  name: string;
  company: string | null;
  jobTitle: string | null;
  email: string | null;
  phone: string | null;
};

export type ApiSnStatusResponse = {
  session_id: string;
  event_id: string;
  event_name: string;
  status: "SCHEDULED" | "RUNNING" | "COMPLETED" | "CANCELLED" | "IDLE";
  is_registered: boolean;
  venue?: string;
  starts_at?: string;
  current_round: number;
  total_rounds: number;
  ready_count: number;
  round_duration_seconds: number;
  break_duration_seconds: number;
  round_ends_at?: string;
  next_round_starts_at?: string;
  my_pair?: {
    pair_id: string;
    round: number;
    score: number;
    match_reason: string;
    round_ends_at?: string;
    counterparty: {
      user_id: string;
      name: string;
      company?: string;
      title?: string;
      avatar_url?: string;
    };
  };
  summary?: {
    total_rounds: number;
    total_pairs: number;
    connected: number;
  };
};

function mapStatus(status: SnSessionStatus): ApiSnStatusResponse["status"] {
  if (status === SnSessionStatus.IN_PROGRESS) return "RUNNING";
  if (status === SnSessionStatus.SCHEDULED) return "SCHEDULED";
  if (status === SnSessionStatus.COMPLETED) return "COMPLETED";
  if (status === SnSessionStatus.CANCELLED) return "CANCELLED";
  return "IDLE";
}

function pairScore(ratingA: number | null, ratingB: number | null): number {
  const scores: number[] = [];
  if (ratingA != null) scores.push(ratingA);
  if (ratingB != null) scores.push(ratingB);
  if (scores.length === 0) return 80;
  const avg = scores.reduce((sum, n) => sum + n, 0) / scores.length;
  return Math.round(avg * 20);
}

function buildMatchReason(counterparty: ParticipantLite): string {
  const company = counterparty.company ? `来自${counterparty.company}` : "";
  const title = counterparty.jobTitle ?? "参会者";
  return `AI 认为你与这位${title}${company ? `（${company}）` : ""}在商业意图上高度互补，值得深入交流。`;
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

function computeRoundTiming(
  startedAt: Date | null,
  currentRound: number,
  roundSeconds: number,
  breakSeconds: number,
) {
  if (!startedAt || currentRound <= 0) {
    return { roundEndsAt: undefined, nextRoundStartsAt: undefined };
  }

  const cycleSeconds = roundSeconds + breakSeconds;
  const roundStartMs =
    startedAt.getTime() + (currentRound - 1) * cycleSeconds * 1000;
  const roundEndsAt = new Date(roundStartMs + roundSeconds * 1000);
  const nextRoundStartsAt = new Date(roundEndsAt.getTime() + breakSeconds * 1000);

  return {
    roundEndsAt: roundEndsAt.toISOString(),
    nextRoundStartsAt: nextRoundStartsAt.toISOString(),
  };
}

export async function getEventSnStatus(
  eventId: string,
  userId: string,
): Promise<ApiSnStatusResponse> {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, name: true, location: true, startDate: true },
  });

  if (!event) {
    throw new ApiError("活动不存在", ErrorCode.NOT_FOUND, 404);
  }

  const session = await prisma.snSession.findFirst({
    where: {
      eventId,
      status: { not: SnSessionStatus.CANCELLED },
    },
    orderBy: { createdAt: "desc" },
    include: {
      pairs: {
        include: {
          participantA: {
            select: {
              id: true,
              name: true,
              company: true,
              jobTitle: true,
              email: true,
              phone: true,
            },
          },
          participantB: {
            select: {
              id: true,
              name: true,
              company: true,
              jobTitle: true,
              email: true,
              phone: true,
            },
          },
        },
        orderBy: [{ round: "asc" }, { createdAt: "asc" }],
      },
    },
  });

  const participant = await findParticipantForUser(eventId, userId);
  const isRegistered = Boolean(participant);

  if (!session) {
    return {
      session_id: "",
      event_id: event.id,
      event_name: event.name,
      status: "IDLE",
      is_registered: isRegistered,
      venue: event.location ?? undefined,
      current_round: 0,
      total_rounds: 0,
      ready_count: 0,
      round_duration_seconds: DEFAULT_ROUND_SECONDS,
      break_duration_seconds: DEFAULT_BREAK_SECONDS,
    };
  }

  const participantIds = new Set<string>();
  for (const pair of session.pairs) {
    participantIds.add(pair.participantAId);
    participantIds.add(pair.participantBId);
  }

  const currentRound =
    session.status === SnSessionStatus.IN_PROGRESS
      ? Math.max(1, ...session.pairs.map((p) => p.round), 1)
      : session.status === SnSessionStatus.COMPLETED
        ? session.roundCount
        : 0;

  const timing = computeRoundTiming(
    session.startedAt,
    currentRound,
    DEFAULT_ROUND_SECONDS,
    DEFAULT_BREAK_SECONDS,
  );

  const startsAt =
    session.status === SnSessionStatus.SCHEDULED
      ? (session.startedAt?.toISOString() ??
        event.startDate?.toISOString() ??
        new Date(Date.now() + DEFAULT_BREAK_SECONDS * 1000).toISOString())
      : session.startedAt?.toISOString();

  let myPair: ApiSnStatusResponse["my_pair"];
  if (participant && session.status === SnSessionStatus.IN_PROGRESS) {
    const activePair = session.pairs.find(
      (p) =>
        p.round === currentRound &&
        (p.participantAId === participant.id || p.participantBId === participant.id),
    );

    if (activePair) {
      const isA = activePair.participantAId === participant.id;
      const counterparty = isA ? activePair.participantB : activePair.participantA;
      const myRating = isA ? activePair.ratingA : activePair.ratingB;
      const theirRating = isA ? activePair.ratingB : activePair.ratingA;
      const counterpartyUserId = await resolveUserIdForParticipant(counterparty);

      myPair = {
        pair_id: activePair.id,
        round: activePair.round,
        score: pairScore(myRating, theirRating),
        match_reason: buildMatchReason(counterparty),
        round_ends_at: timing.roundEndsAt,
        counterparty: {
          user_id: counterpartyUserId,
          name: counterparty.name,
          company: counterparty.company ?? undefined,
          title: counterparty.jobTitle ?? undefined,
        },
      };
    }
  }

  let summary: ApiSnStatusResponse["summary"];
  if (participant && session.status === SnSessionStatus.COMPLETED) {
    const myPairs = session.pairs.filter(
      (p) =>
        p.participantAId === participant.id || p.participantBId === participant.id,
    );
    const rounds = new Set(myPairs.map((p) => p.round));
    summary = {
      total_rounds: rounds.size,
      total_pairs: myPairs.length,
      connected: myPairs.filter((p) => p.connectionEstablished).length,
    };
  }

  return {
    session_id: session.id,
    event_id: event.id,
    event_name: event.name,
    status: mapStatus(session.status),
    is_registered: isRegistered,
    venue: event.location ?? undefined,
    starts_at: startsAt,
    current_round: currentRound,
    total_rounds: session.roundCount,
    ready_count: participantIds.size,
    round_duration_seconds: DEFAULT_ROUND_SECONDS,
    break_duration_seconds: DEFAULT_BREAK_SECONDS,
    round_ends_at: timing.roundEndsAt,
    next_round_starts_at: timing.nextRoundStartsAt,
    my_pair: myPair,
    summary,
  };
}
