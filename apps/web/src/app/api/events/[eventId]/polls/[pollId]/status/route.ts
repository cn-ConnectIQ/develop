import { PollStatus, prisma } from "@connectiq/database";
import { ErrorCode } from "@connectiq/types";
import { z } from "zod";
import {
  createErrorResponse,
  createSuccessResponse,
  requireEventAccess,
  withErrorHandler,
} from "@/lib/api-auth";
import { pushPollToAttendees } from "@/lib/interaction-push-service";

const patchSchema = z.object({
  status: z.enum([PollStatus.LIVE, PollStatus.PAUSED, PollStatus.CLOSED]),
  push: z.boolean().optional(),
});

/** 更新投票状态（主办方） */
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

  if (parsed.data.status === PollStatus.LIVE) {
    await prisma.poll.updateMany({
      where: { eventId, status: PollStatus.LIVE, id: { not: pollId } },
      data: { status: PollStatus.PAUSED },
    });
  }

  const updated = await prisma.poll.update({
    where: { id: pollId },
    data: { status: parsed.data.status },
    include: {
      options: { orderBy: { displayOrder: "asc" } },
      _count: { select: { responses: true } },
    },
  });

  let pushResult = null;
  const shouldPush =
    parsed.data.status === PollStatus.LIVE && parsed.data.push !== false;
  if (shouldPush) {
    try {
      pushResult = await pushPollToAttendees(eventId, pollId);
    } catch {
      pushResult = { sent: 0, skipped: 0, total: 0, error: true };
    }
  }

  return createSuccessResponse({ ...updated, pushResult });
});
