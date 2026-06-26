import { ErrorCode } from "@connectiq/types";
import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api-auth";
import { getEventMySummary } from "@/lib/event-my-summary-service";
import { requireMobileAuth } from "@/lib/mobile-user-id";

/** 会后总结 */
export const GET = withErrorHandler(async (request, context) => {
  const eventId = context?.params?.eventId;
  if (!eventId) {
    return createErrorResponse("缺少活动 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  const { userId } = await requireMobileAuth(request);
  const data = await getEventMySummary(eventId, userId);
  return createSuccessResponse(data);
});
