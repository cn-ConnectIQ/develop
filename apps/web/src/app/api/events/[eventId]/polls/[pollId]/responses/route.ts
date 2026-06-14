import { prisma } from "@connectiq/database";
import { ErrorCode } from "@connectiq/types";
import {
  createErrorResponse,
  createSuccessResponse,
  requireEventAccess,
  withErrorHandler,
} from "@/lib/api-auth";

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

  const results = await aggregateResults(pollId);
  return createSuccessResponse(results);
});
