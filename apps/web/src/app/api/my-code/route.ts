import { ErrorCode } from "@connectiq/types";
import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api-auth";
import { getMyAttendeeCode } from "@/lib/my-code-service";
import { requireMobileAuth } from "@/lib/mobile-user-id";

/** 参会者「我的码」：身份码 + 签到/集章/奖品进度摘要 */
export const GET = withErrorHandler(async (request) => {
  const { searchParams } = new URL(request.url);
  const eventId = searchParams.get("eventId")?.trim();
  if (!eventId) {
    return createErrorResponse("缺少活动 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  const { userId } = await requireMobileAuth(request);
  const data = await getMyAttendeeCode(userId, eventId);
  return createSuccessResponse(data);
});
