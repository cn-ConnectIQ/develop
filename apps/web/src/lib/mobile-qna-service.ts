import { PollStatus, PollType, SignalType, prisma } from "@connectiq/database";
import { ErrorCode } from "@connectiq/types";
import { ApiError } from "@/lib/api-auth";
import {
  ensureParticipantForUser,
  findParticipantForUser,
} from "@/lib/interaction/participant-user";
import { submitPollResponse } from "@/lib/interaction/session-service";
import { listQnaResponses } from "@/lib/qna-service";
import { recordSignal } from "@/lib/signals";

export type ApiMobileQnaItem = {
  id: string;
  text: string;
  upvoteCount: number;
  createdAt: string;
  authorName: string | null;
  isMine: boolean;
};

export type ApiMobileQnaList = {
  pollId: string | null;
  pollTitle: string | null;
  items: ApiMobileQnaItem[];
};

async function findActiveQnaPoll(eventId: string) {
  return prisma.poll.findFirst({
    where: {
      eventId,
      type: PollType.QNA,
      status: { in: [PollStatus.LIVE, PollStatus.PAUSED, PollStatus.CLOSED] },
    },
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    select: { id: true, title: true, status: true },
  });
}

export async function getEventMobileQna(
  eventId: string,
  userId: string | null,
): Promise<ApiMobileQnaList> {
  const poll = await findActiveQnaPoll(eventId);
  if (!poll) {
    return { pollId: null, pollTitle: null, items: [] };
  }

  const qna = await listQnaResponses(eventId, poll.id);
  if (!qna) {
    return { pollId: poll.id, pollTitle: poll.title, items: [] };
  }

  const participant = userId
    ? await findParticipantForUser(eventId, userId)
    : null;

  const items: ApiMobileQnaItem[] = qna.responses
    .filter((row) => !row.isHidden)
    .map((row) => ({
      id: row.id,
      text: row.textAnswer,
      upvoteCount: row.upvoteCount,
      createdAt: row.createdAt,
      authorName: row.participant?.name ?? null,
      isMine: Boolean(participant && row.participant?.id === participant.id),
    }));

  return {
    pollId: poll.id,
    pollTitle: poll.title,
    items,
  };
}

export async function submitEventMobileQnaQuestion(
  eventId: string,
  userId: string,
  text: string,
): Promise<ApiMobileQnaItem> {
  const poll = await findActiveQnaPoll(eventId);
  if (!poll || poll.status !== PollStatus.LIVE) {
    throw new ApiError("当前没有开放的问答", ErrorCode.VALIDATION_ERROR, 400);
  }

  const trimmed = text.trim();
  if (!trimmed) {
    throw new ApiError("问题不能为空", ErrorCode.VALIDATION_ERROR, 400);
  }

  await ensureParticipantForUser(eventId, userId);

  const created = await submitPollResponse(eventId, userId, {
    poll_id: poll.id,
    text_answer: trimmed,
  });

  const responseId = (created as { id: string }).id;
  const row = await prisma.pollResponse.findUnique({
    where: { id: responseId },
    include: {
      participant: { select: { id: true, name: true } },
    },
  });

  return {
    id: responseId,
    text: trimmed,
    upvoteCount: 1,
    createdAt: row?.createdAt.toISOString() ?? new Date().toISOString(),
    authorName: row?.participant?.name ?? null,
    isMine: true,
  };
}

export async function upvoteEventMobileQnaQuestion(
  eventId: string,
  userId: string,
  responseId: string,
): Promise<{ id: string; upvoteCount: number }> {
  const poll = await findActiveQnaPoll(eventId);
  if (!poll) {
    throw new ApiError("问答不存在", ErrorCode.NOT_FOUND, 404);
  }

  const target = await prisma.pollResponse.findFirst({
    where: { id: responseId, pollId: poll.id },
    select: { id: true, textAnswer: true },
  });
  if (!target?.textAnswer?.trim()) {
    throw new ApiError("问题不存在", ErrorCode.NOT_FOUND, 404);
  }

  const text = target.textAnswer.trim();
  const participant = await ensureParticipantForUser(eventId, userId);

  await prisma.pollResponse.create({
    data: {
      pollId: poll.id,
      participantId: participant?.id ?? null,
      textAnswer: text,
    },
  });

  recordSignal(userId, eventId, SignalType.QNA_UPVOTED, target.id, "QNA", {
    question_text: text,
    poll_id: poll.id,
  });

  const rows = await prisma.pollResponse.findMany({
    where: { pollId: poll.id, textAnswer: { equals: text, mode: "insensitive" } },
    select: { id: true },
  });

  return { id: responseId, upvoteCount: rows.length };
}
