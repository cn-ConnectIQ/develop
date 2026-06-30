import { MeetingStatus } from "@connectiq/database";
import { ErrorCode } from "@connectiq/types";
import { z } from "zod";
import {
  createErrorResponse,
  createSuccessResponse,
  requireEventAccess,
  withErrorHandler,
} from "@/lib/api-auth";
import {
  getEventMeetingStats,
  listEventMeetings,
} from "@/lib/meetings/schedule-service";
import { requireMobileEventAccess } from "@/lib/mobile-user-id";

async function requireMeetingReadAccess(request: Request, eventId: string) {
  try {
    await requireEventAccess(eventId);
    return;
  } catch {
    await requireMobileEventAccess(request, eventId);
  }
}

export const GET = withErrorHandler(async (request, context) => {
  const eventId = context?.params?.eventId;
  if (!eventId) {
    return createErrorResponse("缺少活动 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  await requireMeetingReadAccess(request, eventId);

  const { searchParams } = new URL(request.url);
  const statusParam = searchParams.get("status");
  const status =
    statusParam && statusParam in MeetingStatus
      ? (statusParam as MeetingStatus)
      : undefined;

  const [meetings, stats] = await Promise.all([
    listEventMeetings(eventId, {
      status,
      from: searchParams.get("from") ?? undefined,
      to: searchParams.get("to") ?? undefined,
    }),
    getEventMeetingStats(eventId),
  ]);

  return createSuccessResponse({ meetings, stats });
});
