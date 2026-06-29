import { ErrorCode } from "@connectiq/types";
import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api-auth";
import { getEventReportSummary } from "@/lib/reports";
import { requireMobileEventAccess } from "@/lib/mobile-user-id";

export const GET = withErrorHandler(async (request, context) => {
  const eventId = context?.params?.eventId;
  if (!eventId) {
    return createErrorResponse("缺少活动 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  await requireMobileEventAccess(request, eventId);
  const summary = await getEventReportSummary(eventId);

  if (!summary) {
    return createErrorResponse("活动不存在", ErrorCode.NOT_FOUND, 404);
  }

  return createSuccessResponse(summary);
});
