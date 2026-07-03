import { ErrorCode } from "@connectiq/types";
import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api-auth";
import { getMyRedemptionCode } from "@/lib/lottery/redemption";
import { requireMobileAuth } from "@/lib/mobile-user-id";

/** 获取/创建当前用户在某活动下的统一核销码 */
export const GET = withErrorHandler(async (request) => {
  const { searchParams } = new URL(request.url);
  const eventId = searchParams.get("eventId")?.trim();
  if (!eventId) {
    return createErrorResponse("缺少活动 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  const { userId } = await requireMobileAuth(request);
  const data = await getMyRedemptionCode(userId, eventId);
  return createSuccessResponse(data);
});
