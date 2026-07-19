import { ErrorCode } from "@connectiq/types";
import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api-auth";
import { listEventAnnouncements } from "@/lib/interactions/aggregate";
import { assertAttendeeReadableEvent } from "@/lib/public-event-access";

/** 活动公告列表（参会端；与 interactions?type=ANNOUNCEMENT 同源） */
export const GET = withErrorHandler(async (request, context) => {
  const eventId = context?.params?.eventId;
  if (!eventId) {
    return createErrorResponse("缺少活动 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  await assertAttendeeReadableEvent(eventId);

  const url = new URL(request.url);
  const limitRaw = url.searchParams.get("limit");
  const limit = limitRaw ? Number(limitRaw) : undefined;
  if (limitRaw && (!Number.isFinite(limit) || limit! <= 0)) {
    return createErrorResponse("limit 须为正整数", ErrorCode.VALIDATION_ERROR, 400);
  }

  const announcements = await listEventAnnouncements(eventId, limit);
  return createSuccessResponse({
    announcements,
    items: announcements,
  }, { total: announcements.length });
});
