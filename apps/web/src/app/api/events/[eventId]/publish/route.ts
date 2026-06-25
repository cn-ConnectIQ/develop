import { ErrorCode } from "@connectiq/types";
import {
  createErrorResponse,
  createSuccessResponse,
  requireEventAccess,
  withErrorHandler,
} from "@/lib/api-auth";
import {
  EventReviewError,
  publishEvent,
} from "@/lib/event-review-service";

export const POST = withErrorHandler(async (_request, context) => {
  const eventId = context?.params?.eventId;
  if (!eventId) {
    return createErrorResponse("缺少活动 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  await requireEventAccess(eventId);

  try {
    const result = await publishEvent(eventId);
    return createSuccessResponse(result);
  } catch (error) {
    if (error instanceof EventReviewError) {
      const status =
        error.code === "NOT_FOUND"
          ? 404
          : error.code === "VALIDATION_ERROR"
            ? 400
            : 409;
      return createErrorResponse(error.message, ErrorCode.VALIDATION_ERROR, status);
    }
    throw error;
  }
});
