import { prisma, PollStatus } from "@connectiq/database";
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
  if (!eventId) {
    return createErrorResponse("缺少活动 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  await requireEventAccess(eventId);

  const [livePoll, draftPolls, participantCount, checkInCount] =
    await Promise.all([
      prisma.poll.findFirst({
        where: { eventId, status: PollStatus.LIVE },
        include: {
          options: { orderBy: { displayOrder: "asc" } },
          _count: { select: { responses: true } },
        },
      }),
      prisma.poll.findMany({
        where: { eventId, status: PollStatus.DRAFT },
        orderBy: [{ scheduledAt: "asc" }, { displayOrder: "asc" }],
        take: 5,
        select: {
          id: true,
          title: true,
          type: true,
          scheduledAt: true,
        },
      }),
      prisma.participant.count({ where: { eventId } }),
      prisma.checkIn.count({ where: { eventId } }),
    ]);

  let results = null;
  let wordCloud: Array<{ text: string; count: number }> = [];
  let qnaQuestions: ReturnType<typeof buildQnaQuestions> = [];
  let display = null;

  if (livePoll) {
    const [responses, displayConfig] = await Promise.all([
      prisma.pollResponse.findMany({
        where: { pollId: livePoll.id },
        select: {
          id: true,
          optionId: true,
          textAnswer: true,
          createdAt: true,
        },
      }),
      getPollDisplayConfig(eventId, livePoll.id, livePoll.showResults),
    ]);

    display = displayConfig;
    const total = responses.length;

    if (livePoll.type === "WORD_CLOUD") {
      wordCloud = aggregateWordCloud(responses);
      results = { total, options: [] };
    } else if (livePoll.type === "QNA") {
      qnaQuestions = buildQnaQuestions(responses, displayConfig);
      results = { total, options: [] };
    } else {
      const options = aggregatePollOptions(livePoll.options, responses);
      results = { total, options };
    }
  }

  const nextPoll =
    draftPolls.find((p) => p.scheduledAt) ?? draftPolls[0] ?? null;
  const queueDrafts = nextPoll
    ? draftPolls.filter((p) => p.id !== nextPoll.id)
    : draftPolls;

  return createSuccessResponse({
    livePoll: livePoll
      ? {
          id: livePoll.id,
          title: livePoll.title,
          type: livePoll.type,
          status: livePoll.status,
          showResults: display?.showResults ?? livePoll.showResults,
          closesAt: livePoll.closesAt?.toISOString() ?? null,
          createdAt: livePoll.createdAt.toISOString(),
          responseCount: livePoll._count.responses,
        }
      : null,
    display,
    results,
    wordCloud,
    qnaQuestions,
    queue: {
      next: nextPoll,
      drafts: queueDrafts,
    },
    stats: {
      checkedIn: checkInCount,
      onSite: Math.floor(checkInCount * 0.85),
      participants: participantCount,
      participationRate:
        participantCount > 0
          ? Math.round((checkInCount / participantCount) * 100)
          : 0,
    },
  });
});
