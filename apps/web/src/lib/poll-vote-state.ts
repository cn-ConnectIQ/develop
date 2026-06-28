import { PollType, prisma } from "@connectiq/database";
import { findParticipantForUser } from "@/lib/interaction/participant-user";

export type PollVoteState = {
  hasVoted: boolean;
  myOptionId: string | null;
  myOptionIds: string[];
};

export async function loadPollVoteState(
  eventId: string,
  pollId: string,
  pollType: PollType,
  userId: string | null,
): Promise<PollVoteState> {
  const empty: PollVoteState = {
    hasVoted: false,
    myOptionId: null,
    myOptionIds: [],
  };

  if (!userId) return empty;

  const participant = await findParticipantForUser(eventId, userId);
  if (!participant) return empty;

  const responses = await prisma.pollResponse.findMany({
    where: { pollId, participantId: participant.id },
    select: { optionId: true, textAnswer: true, rating: true },
    orderBy: { createdAt: "asc" },
  });

  if (responses.length === 0) return empty;

  const optionIds = responses
    .map((row) => row.optionId)
    .filter((id): id is string => Boolean(id));

  const hasTextOrRating = responses.some(
    (row) => Boolean(row.textAnswer?.trim()) || row.rating != null,
  );

  const hasVoted =
    pollType === PollType.WORD_CLOUD || pollType === PollType.QNA
      ? hasTextOrRating || optionIds.length > 0
      : optionIds.length > 0 || hasTextOrRating;

  return {
    hasVoted,
    myOptionId: optionIds[0] ?? null,
    myOptionIds: pollType === PollType.MULTI_CHOICE ? optionIds : optionIds.slice(0, 1),
  };
}
