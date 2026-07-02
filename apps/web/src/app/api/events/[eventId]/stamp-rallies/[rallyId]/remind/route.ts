import { ErrorCode } from "@connectiq/types";
import {
  createErrorResponse,
  createSuccessResponse,
  requireEventAccess,
  withErrorHandler,
} from "@/lib/api-auth";
import { sendStampRallyReminders } from "@/lib/stamp/stamp-rally-organizer-service";

export const POST = withErrorHandler(async (_request, context) => {
  const eventId = context?.params?.eventId;
  const rallyId = context?.params?.rallyId;
  if (!eventId || !rallyId) {
    return createErrorResponse("参数缺失", ErrorCode.VALIDATION_ERROR, 400);
  }

  await requireEventAccess(eventId);
  const result = await sendStampRallyReminders(eventId, rallyId);
  return createSuccessResponse(result);
});
