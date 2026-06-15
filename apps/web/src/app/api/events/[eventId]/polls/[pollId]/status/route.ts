import { PollStatus, prisma } from "@connectiq/database";
import { ErrorCode, UserRole } from "@connectiq/types";
import { z } from "zod";
import {
  createErrorResponse,
  createSuccessResponse,
  requireAuth,
  withErrorHandler,
} from "@/lib/api-auth";

const patchSchema = z.object({
  status: z.enum([PollStatus.LIVE, PollStatus.PAUSED, PollStatus.CLOSED]),
});

/** 更新投票状态（主办方） */
export const PATCH = withErrorHandler(async (request, context) => {
  const eventId = context?.params?.eventId;
  const pollId = context?.params?.pollId;
  if (!eventId || !pollId) {
    return createErrorResponse("参数缺失", ErrorCode.VALIDATION_ERROR, 400);
  }

  await requireAuth(request, [
    UserRole.PLATFORM_ADMIN,
    UserRole.ORGANIZER,
    UserRole.EXPO_ORGANIZER,
  ]);

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

  return createSuccessResponse(updated);
});
