import { ErrorCode } from "@connectiq/types";
import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api-auth";
import { loadEventDashboardPayload } from "@/lib/event-dashboard-server";

export const GET = withErrorHandler(async (_request, context) => {
  const eventId = context?.params?.eventId;
  if (!eventId) {
    return createErrorResponse("缺少活动 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  const payload = await loadEventDashboardPayload(eventId);
  if (!payload) {
    return createErrorResponse("无权访问或加载失败", ErrorCode.FORBIDDEN, 403);
  }

  return createSuccessResponse(payload);
});
