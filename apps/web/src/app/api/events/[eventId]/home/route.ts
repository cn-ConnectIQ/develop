import { ErrorCode } from "@connectiq/types";
import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api-auth";
import { getEventDashboardMobile } from "@/lib/event-dashboard-mobile-service";
import { resolveOptionalMobileUserId } from "@/lib/mobile-user-id";

/** 小程序活动主页聚合数据（别名：home；未登录返回公开字段） */
export const GET = withErrorHandler(async (request, context) => {
  const eventId = context?.params?.eventId;
  if (!eventId) {
    return createErrorResponse("缺少活动 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  const userId = await resolveOptionalMobileUserId(request);
  const dashboard = await getEventDashboardMobile(eventId, userId);
  return createSuccessResponse(dashboard);
});
