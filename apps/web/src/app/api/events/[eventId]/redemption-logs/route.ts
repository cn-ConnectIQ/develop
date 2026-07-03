import { ErrorCode } from "@connectiq/types";
import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api-auth";
import {
  getTodayRedemptionLogs,
  requireRedemptionStaffAccess,
} from "@/lib/lottery/redemption";

/** 今日核销记录 */
export const GET = withErrorHandler(async (request, context) => {
  const eventId = context?.params?.eventId;
  if (!eventId) {
    return createErrorResponse("缺少活动 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  await requireRedemptionStaffAccess(request, eventId);
  const logs = await getTodayRedemptionLogs(eventId);
  return createSuccessResponse({ logs });
});
