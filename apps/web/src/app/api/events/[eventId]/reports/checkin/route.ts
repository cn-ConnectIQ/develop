import { ErrorCode } from "@connectiq/types";
import {
  createErrorResponse,
  createSuccessResponse,
  requireEventAccess,
  withErrorHandler,
} from "@/lib/api-auth";
import { getCheckinReport } from "@/lib/reports";

export const GET = withErrorHandler(async (_request, context) => {
  const eventId = context?.params?.eventId;
  if (!eventId) {
    return createErrorResponse("缺少活动 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  await requireEventAccess(eventId);
  const data = await getCheckinReport(eventId);

  if (!data) {
    return createErrorResponse("活动不存在", ErrorCode.NOT_FOUND, 404);
  }

  return createSuccessResponse(data);
});
