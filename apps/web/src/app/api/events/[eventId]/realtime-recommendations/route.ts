import { ErrorCode } from "@connectiq/types";
import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api-auth";
import { getEventRealtimeRecommendations } from "@/lib/realtime-recommendations-service";
import { requireMobileAuth } from "@/lib/mobile-user-id";

/** 现场动态 AI 推荐 — 行为事件流驱动，超越静态会前匹配 */
export const GET = withErrorHandler(async (request, context) => {
  const eventId = context?.params?.eventId;
  if (!eventId) {
    return createErrorResponse("缺少活动 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  const { userId } = await requireMobileAuth(request);
  const data = await getEventRealtimeRecommendations(userId, eventId);
  return createSuccessResponse(data);
});
