import { prisma } from "@connectiq/database";
import { ApiError } from "@/lib/api-auth";
import { buildQnaQuestions } from "@/lib/bigscreen-display";
import { getPollDisplayConfig } from "@/lib/bigscreen-service";
import {
  aggregatePollOptions,
  aggregateWordCloud,
} from "@/lib/bigscreen-results";
import { serializePollOptionResults } from "@/lib/poll-mobile-api";
import { ErrorCode } from "@connectiq/types";

export async function getPollRealtimeResults(eventId: string, pollId: string) {
  const poll = await prisma.poll.findFirst({
    where: { id: pollId, eventId },
    include: {
      options: { orderBy: { displayOrder: "asc" } },
      responses: {
        select: {
          id: true,
          optionId: true,
          textAnswer: true,
          isOnScreen: true,
          createdAt: true,
        },
      },
    },
  });

  if (!poll) {
    throw new ApiError("投票不存在", ErrorCode.NOT_FOUND, 404);
  }

  const display = await getPollDisplayConfig(eventId, pollId, poll.showResults);
  const total = poll.responses.length;
  const checkInCount = await prisma.checkIn.count({ where: { eventId } });
  const onsiteCount = checkInCount;

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

  const onScreenResponse =
    poll.responses.find((r) => r.isOnScreen) ??
    null;

  const featuredQuestion =
    qnaQuestions.find((q) => q.onScreen && !q.hidden) ??
    qnaQuestions.find((q) => q.featured && !q.hidden) ??
    qnaQuestions.find((q) => !q.hidden) ??
    null;

  return {
    pollId: poll.id,
    title: poll.title,
    type: poll.type,
    status: poll.status,
    showResults: display.showResults,
    display,
    closesAt: poll.closesAt?.toISOString() ?? null,
    ends_at: poll.closesAt?.toISOString() ?? null,
    createdAt: poll.createdAt.toISOString(),
    total,
    onsite_count: onsiteCount,
    options: serializePollOptionResults(options),
    wordCloud,
    qnaQuestions,
    featuredQuestion,
    onScreenResponseId: onScreenResponse?.id ?? null,
    updatedAt: new Date().toISOString(),
  };
}
