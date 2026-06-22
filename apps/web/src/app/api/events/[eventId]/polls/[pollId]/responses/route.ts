import { PollType, SignalType, prisma } from "@connectiq/database";
import { ErrorCode } from "@connectiq/types";
import { getServerSession } from "next-auth";
import { z } from "zod";
import {
  createErrorResponse,
  createSuccessResponse,
  requireEventAccess,
  withErrorHandler,
} from "@/lib/api-auth";
import { listQnaResponses, markAllQnaAnswered } from "@/lib/qna-service";
import { updatePollDisplayConfig } from "@/lib/bigscreen-service";
import { recordSignal } from "@/lib/signals";
import { authOptions } from "@/lib/auth";

async function aggregateResults(pollId: string) {
  const poll = await prisma.poll.findUnique({
    where: { id: pollId },
    include: {
      options: { orderBy: { displayOrder: "asc" } },
      responses: true,
    },
  });

  if (!poll) return null;

  const totalResponses = poll.responses.length;
  const optionStats = poll.options.map((option) => {
    const count = poll.responses.filter((r) => r.optionId === option.id).length;
    return {
      id: option.id,
      text: option.text,
      count,
      percentage:
        totalResponses > 0
          ? Math.round((count / totalResponses) * 1000) / 10
          : 0,
    };
  });

  optionStats.sort((a, b) => b.count - a.count);

  const wordCloud = poll.responses
    .filter((r) => r.textAnswer)
    .reduce<Record<string, number>>((acc, r) => {
      const word = r.textAnswer!.trim();
      if (!word) return acc;
      acc[word] = (acc[word] ?? 0) + 1;
      return acc;
    }, {});

  const ratings = poll.responses
    .map((r) => r.rating)
    .filter((r): r is number => r != null);
  const averageRating =
    ratings.length > 0
      ? ratings.reduce((a, b) => a + b, 0) / ratings.length
      : undefined;

  return {
    poll: {
      id: poll.id,
      title: poll.title,
      type: poll.type,
      status: poll.status,
      showResults: poll.showResults,
      closesAt: poll.closesAt,
    },
    totalResponses,
    options: optionStats,
    wordCloud: Object.entries(wordCloud)
      .map(([text, count]) => ({ text, count }))
      .sort((a, b) => b.count - a.count),
    averageRating,
  };
}

const createQnaSchema = z.object({
  text_answer: z.string().min(1).max(500),
  participant_id: z.string().cuid().optional(),
});

const postActionSchema = z.object({
  action: z.literal("mark_all_answered"),
});

export const GET = withErrorHandler(async (_request, context) => {
  const eventId = context?.params?.eventId;
  const pollId = context?.params?.pollId;
  if (!eventId || !pollId) {
    return createErrorResponse("参数缺失", ErrorCode.VALIDATION_ERROR, 400);
  }

  await requireEventAccess(eventId);

  const poll = await prisma.poll.findFirst({
    where: { id: pollId, eventId },
  });
  if (!poll) {
    return createErrorResponse("投票不存在", ErrorCode.NOT_FOUND, 404);
  }

  if (poll.type === PollType.QNA) {
    const qna = await listQnaResponses(eventId, pollId);
    if (!qna) {
      return createErrorResponse("问答不存在", ErrorCode.NOT_FOUND, 404);
    }
    return createSuccessResponse(qna);
  }

  const results = await aggregateResults(pollId);
  return createSuccessResponse(results);
});

export const POST = withErrorHandler(async (request, context) => {
  const eventId = context?.params?.eventId;
  const pollId = context?.params?.pollId;
  if (!eventId || !pollId) {
    return createErrorResponse("参数缺失", ErrorCode.VALIDATION_ERROR, 400);
  }

  await requireEventAccess(eventId);

  const poll = await prisma.poll.findFirst({
    where: { id: pollId, eventId, type: PollType.QNA },
  });
  if (!poll) {
    return createErrorResponse("问答不存在", ErrorCode.NOT_FOUND, 404);
  }

  const body = await request.json();

  const actionParsed = postActionSchema.safeParse(body);
  if (actionParsed.success) {
    const patch = await markAllQnaAnswered(eventId, pollId);
    if (!patch) {
      return createErrorResponse("操作失败", ErrorCode.NOT_FOUND, 404);
    }
    const display = await updatePollDisplayConfig(eventId, pollId, patch);
    return createSuccessResponse({ display });
  }

  const parsed = createQnaSchema.safeParse(body);
  if (!parsed.success) {
    return createErrorResponse(
      parsed.error.issues[0]?.message ?? "参数错误",
      ErrorCode.VALIDATION_ERROR,
      400,
    );
  }

  if (parsed.data.participant_id) {
    const participant = await prisma.participant.findFirst({
      where: { id: parsed.data.participant_id, eventId },
    });
    if (!participant) {
      return createErrorResponse("参会者不存在", ErrorCode.NOT_FOUND, 404);
    }
  }

  const text = parsed.data.text_answer.trim();

  const duplicateQna = await prisma.pollResponse.findFirst({
    where: {
      pollId,
      textAnswer: { equals: text, mode: "insensitive" },
    },
    select: { id: true },
  });

  const created = await prisma.pollResponse.create({
    data: {
      pollId,
      participantId: parsed.data.participant_id ?? null,
      textAnswer: text,
    },
    include: {
      participant: {
        select: { id: true, name: true, company: true, jobTitle: true },
      },
    },
  });

  const authSession = await getServerSession(authOptions);
  const userId = authSession?.user?.id;
  if (userId) {
    if (duplicateQna) {
      recordSignal(userId, eventId, SignalType.QNA_UPVOTED, duplicateQna.id, "QNA", {
        question_text: text,
        poll_id: pollId,
      });
    } else {
      recordSignal(userId, eventId, SignalType.QNA_ASKED, pollId, "QNA", {
        question_text: text,
      });
    }
  }

  return createSuccessResponse({
    id: created.id,
    text_answer: created.textAnswer,
    created_at: created.createdAt.toISOString(),
    participant: created.participant,
  });
});
