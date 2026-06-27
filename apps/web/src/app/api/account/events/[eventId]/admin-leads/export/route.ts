import { ErrorCode } from "@connectiq/types";
import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api-auth";
import { exportAdminLeadsMarketUp } from "@/lib/mobile-admin-ops-service";
import { requireMobileAccountAdmin } from "@/lib/mobile-user-id";

/** AD4 线索导出 MarketUP（异步任务 stub） */
export const POST = withErrorHandler(async (request, context) => {
  const eventId = context?.params?.eventId;
  if (!eventId) {
    return createErrorResponse("缺少活动 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  const { orgId } = await requireMobileAccountAdmin(request);
  const result = await exportAdminLeadsMarketUp(orgId, eventId);
  return createSuccessResponse(result);
});
