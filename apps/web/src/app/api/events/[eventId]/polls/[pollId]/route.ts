import { prisma, PollStatus } from "@connectiq/database";
import { ErrorCode } from "@connectiq/types";
import { z } from "zod";
import {
  createErrorResponse,
  createSuccessResponse,
  requireEventAccess,
  withErrorHandler,
} from "@/lib/api-auth";

const patchSchema = z.object({
  status: z.nativeEnum(PollStatus).optional(),
  title: z.string().min(1).max(200).optional(),
  showResults: z.boolean().optional(),
  extendMinutes: z.number().optional(),
  timeLimitMinutes: z.number().optional(),
  options: z.array(z.object({ id: z.string().optional(), text: z.string().min(1) })).optional(),
});

export const PATCH = withErrorHandler(async (request, context) => {
  const eventId = context?.params?.eventId;
  const pollId = context?.params?.pollId;
  if (!eventId || !pollId) {
    return createErrorResponse("参数缺失", ErrorCode.VALIDATION_ERROR, 400);
  }

  await requireEventAccess(eventId);
  const body = await request.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return createErrorResponse("参数错误", ErrorCode.VALIDATION_ERROR, 400);
  }

  const poll = await prisma.poll.findFirst({
    where: { id: pollId, eventId },
  });
  if (!poll) {
    return createErrorResponse("投票不存在", ErrorCode.NOT_FOUND, 404);
  }

  let closesAt = poll.closesAt;
  if (parsed.data.extendMinutes && closesAt) {
    closesAt = new Date(closesAt.getTime() + parsed.data.extendMinutes * 60 * 1000);
  }

  if (parsed.data.status === PollStatus.LIVE) {
    await prisma.poll.updateMany({
      where: { eventId, status: PollStatus.LIVE, id: { not: pollId } },
      data: { status: PollStatus.PAUSED },
    });
  }

  if (parsed.data.options) {
    await prisma.pollOption.deleteMany({ where: { pollId } });
    await prisma.pollOption.createMany({
      data: parsed.data.options.map((opt, index) => ({
        pollId,
        text: opt.text,
        displayOrder: index,
      })),
    });
  }

  if (parsed.data.timeLimitMinutes && parsed.data.status === PollStatus.LIVE) {
    closesAt = new Date(Date.now() + parsed.data.timeLimitMinutes * 60 * 1000);
  }

  const updated = await prisma.poll.update({
    where: { id: pollId },
    data: {
      status: parsed.data.status,
      title: parsed.data.title,
      showResults: parsed.data.showResults,
      closesAt,
    },
    include: {
      options: { orderBy: { displayOrder: "asc" } },
      _count: { select: { responses: true } },
    },
  });

  return createSuccessResponse(updated);
});

export const DELETE = withErrorHandler(async (_request, context) => {
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

  await prisma.poll.delete({ where: { id: pollId } });
  return createSuccessResponse({ deleted: true });
});
