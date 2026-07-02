import { ErrorCode } from "@connectiq/types";
import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api-auth";
import { resolveMobileUserId } from "@/lib/mobile-user-id";
import { listActiveLotteriesForEvent } from "@/lib/event-home-discovery-service";

/** 进行中的抽奖（AI 意图排序） */
export const GET = withErrorHandler(async (request, context) => {
  const eventId = context?.params?.eventId;
  if (!eventId) {
    return createErrorResponse("参数缺失", ErrorCode.VALIDATION_ERROR, 400);
  }

  const userId = await resolveMobileUserId(request).catch(() => null);
  const items = await listActiveLotteriesForEvent(eventId, userId);
  return createSuccessResponse({ items });
});
