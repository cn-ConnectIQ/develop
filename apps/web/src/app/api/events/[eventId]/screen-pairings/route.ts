import { ErrorCode } from "@connectiq/types";
import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api-auth";
import { requireEventAccessMobileOrWeb } from "@/lib/mobile-event-access";
import { listPairedScreensForEvent } from "@/lib/screen-pairing/service";

export const GET = withErrorHandler(async (request, context) => {
  const eventId = context?.params?.eventId;
  if (!eventId) {
    return createErrorResponse("缺少活动 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  await requireEventAccessMobileOrWeb(request, eventId);

  const items = await listPairedScreensForEvent(eventId);
  return createSuccessResponse({ items, total: items.length });
});
