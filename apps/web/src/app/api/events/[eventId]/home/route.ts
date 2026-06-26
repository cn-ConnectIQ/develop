import { ErrorCode } from "@connectiq/types";
import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api-auth";
import { getEventDashboardMobile } from "@/lib/event-dashboard-mobile-service";
import { resolveMobileUserId } from "@/lib/mobile-user-id";

/** 小程序活动主页聚合数据（别名：home） */
export const GET = withErrorHandler(async (request, context) => {
  const eventId = context?.params?.eventId;
  if (!eventId) {
    return createErrorResponse("缺少活动 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  const userId = await resolveMobileUserId(request);
  const dashboard = await getEventDashboardMobile(eventId, userId);
  return createSuccessResponse(dashboard);
});
