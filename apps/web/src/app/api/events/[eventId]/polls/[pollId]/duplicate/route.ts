import { PollStatus, prisma } from "@connectiq/database";
import { ErrorCode } from "@connectiq/types";
import {
  createErrorResponse,
  createSuccessResponse,
  requireEventAccess,
  withErrorHandler,
} from "@/lib/api-auth";

export const POST = withErrorHandler(async (_request, context) => {
  const eventId = context?.params?.eventId;
  const pollId = context?.params?.pollId;
  if (!eventId || !pollId) {
    return createErrorResponse("参数缺失", ErrorCode.VALIDATION_ERROR, 400);
  }
  const { session } = await requireEventAccess(eventId);

  const source = await prisma.poll.findFirst({
    where: { id: pollId, eventId },
    include: { options: { orderBy: { displayOrder: "asc" } } },
  });
  if (!source) {
    return createErrorResponse("互动不存在", ErrorCode.NOT_FOUND, 404);
  }

  const copied = await prisma.poll.create({
    data: {
      eventId,
      createdById: session.user.id,
      title: `${source.title}（副本）`,
      type: source.type,
      status: PollStatus.DRAFT,
      showResults: source.showResults,
      options: source.options.length
        ? {
            create: source.options.map((o) => ({
              text: o.text,
              displayOrder: o.displayOrder,
            })),
          }
        : undefined,
    },
    include: {
      options: { orderBy: { displayOrder: "asc" } },
      _count: { select: { responses: true } },
    },
  });

  return createSuccessResponse(copied);
});
