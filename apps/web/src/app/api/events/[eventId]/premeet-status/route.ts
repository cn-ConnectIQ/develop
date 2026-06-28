import { ErrorCode } from "@connectiq/types";
import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api-auth";
import { getEventPremeetStatus } from "@/lib/event-premeet-service";
import { resolveOptionalMobileUserId } from "@/lib/mobile-user-id";

/** 会前预热主页状态（未登录返回公开推荐） */
export const GET = withErrorHandler(async (request, context) => {
  const eventId = context?.params?.eventId;
  if (!eventId) {
    return createErrorResponse("缺少活动 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  const userId = await resolveOptionalMobileUserId(request);
  const data = await getEventPremeetStatus(eventId, userId);
  return createSuccessResponse(data);
});
