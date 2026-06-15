import { prisma } from "@connectiq/database";
import { ErrorCode, UserRole } from "@connectiq/types";
import { z } from "zod";
import {
  createErrorResponse,
  createSuccessResponse,
  requireAuth,
  withErrorHandler,
} from "@/lib/api-auth";
import { updatePollDisplayConfig } from "@/lib/bigscreen-service";

const patchSchema = z.object({
  is_on_screen: z.boolean(),
});

/** Q&A 上屏控制（主办方） */
export const PATCH = withErrorHandler(async (request, context) => {
  const eventId = context?.params?.eventId;
  const pollId = context?.params?.pollId;
  const responseId = context?.params?.responseId;
  if (!eventId || !pollId || !responseId) {
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

  const response = await prisma.pollResponse.findFirst({
    where: { id: responseId, pollId, poll: { eventId } },
  });
  if (!response) {
    return createErrorResponse("回答不存在", ErrorCode.NOT_FOUND, 404);
  }

  const updated = await prisma.$transaction(async (tx) => {
    if (parsed.data.is_on_screen) {
      await tx.pollResponse.updateMany({
        where: { pollId, isOnScreen: true },
        data: { isOnScreen: false },
      });
    }

    const row = await tx.pollResponse.update({
      where: { id: responseId },
      data: { isOnScreen: parsed.data.is_on_screen },
    });

    if (parsed.data.is_on_screen) {
      await updatePollDisplayConfig(eventId, pollId, {
        featuredResponseId: responseId,
      });
    }

    return row;
  });

  return createSuccessResponse({
    id: updated.id,
    poll_id: updated.pollId,
    is_on_screen: updated.isOnScreen,
  });
});
