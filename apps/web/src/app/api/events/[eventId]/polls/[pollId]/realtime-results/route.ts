import { prisma } from "@connectiq/database";
import { ErrorCode } from "@connectiq/types";
import {
  createErrorResponse,
  createSuccessResponse,
  requireEventAccess,
  withErrorHandler,
} from "@/lib/api-auth";
import { buildQnaQuestions } from "@/lib/bigscreen-display";
import { getPollDisplayConfig } from "@/lib/bigscreen-service";
import {
  aggregatePollOptions,
  aggregateWordCloud,
} from "@/lib/bigscreen-results";

export const GET = withErrorHandler(async (_request, context) => {
  const eventId = context?.params?.eventId;
  const pollId = context?.params?.pollId;
  if (!eventId || !pollId) {
    return createErrorResponse("参数缺失", ErrorCode.VALIDATION_ERROR, 400);
  }

  await requireEventAccess(eventId);

  const poll = await prisma.poll.findFirst({
    where: { id: pollId, eventId },
    include: {
      options: { orderBy: { displayOrder: "asc" } },
      responses: {
        select: {
          id: true,
          optionId: true,
          textAnswer: true,
          createdAt: true,
        },
      },
    },
  });

  if (!poll) {
    return createErrorResponse("投票不存在", ErrorCode.NOT_FOUND, 404);
  }

  const display = await getPollDisplayConfig(eventId, pollId, poll.showResults);
  const total = poll.responses.length;

  let options: ReturnType<typeof aggregatePollOptions> = [];
  let wordCloud: ReturnType<typeof aggregateWordCloud> = [];
  let qnaQuestions: ReturnType<typeof buildQnaQuestions> = [];

  if (poll.type === "WORD_CLOUD") {
    wordCloud = aggregateWordCloud(poll.responses);
  } else if (poll.type === "QNA") {
    qnaQuestions = buildQnaQuestions(poll.responses, display);
  } else {
    options = aggregatePollOptions(poll.options, poll.responses);
  }

  const featuredQuestion =
    qnaQuestions.find((q) => q.featured && !q.hidden) ??
    qnaQuestions.find((q) => !q.hidden) ??
    null;

  return createSuccessResponse({
    pollId: poll.id,
    title: poll.title,
    type: poll.type,
    status: poll.status,
    showResults: display.showResults,
    display,
    closesAt: poll.closesAt?.toISOString() ?? null,
    createdAt: poll.createdAt.toISOString(),
    total,
    options,
    wordCloud,
    qnaQuestions,
    featuredQuestion,
    updatedAt: new Date().toISOString(),
  });
});
