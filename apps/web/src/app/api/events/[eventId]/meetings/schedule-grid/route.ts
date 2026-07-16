import { ErrorCode } from "@connectiq/types";
import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api-auth";
import { getEventScheduleGrid } from "@/lib/meetings/schedule-service";
import { requireEventAccessMobileOrWeb } from "@/lib/mobile-event-access";

export const GET = withErrorHandler(async (request, context) => {
  const eventId = context?.params?.eventId;
  if (!eventId) {
    return createErrorResponse("缺少活动 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  await requireEventAccessMobileOrWeb(request, eventId);

  const grid = await getEventScheduleGrid(eventId);
  return createSuccessResponse(grid);
});
