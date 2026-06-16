import { ErrorCode } from "@connectiq/types";
import {
  createErrorResponse,
  createSuccessResponse,
  requireEventAccess,
  withErrorHandler,
} from "@/lib/api-auth";
import { getEventDashboardData } from "@/lib/dashboard";
import { getEventPhase } from "@/lib/event-utils";

export const GET = withErrorHandler(async (_request, context) => {
  const eventId = context?.params?.eventId;
  if (!eventId) {
    return createErrorResponse("缺少活动 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  const { event } = await requireEventAccess(eventId);
  const phase = getEventPhase(event);
  const { stats, feed, alerts } = await getEventDashboardData(eventId);

  return createSuccessResponse({
    event: {
      id: event.id,
      name: event.name,
      status: event.status,
      reviewStatus: event.reviewStatus,
      startDate: event.startDate,
      endDate: event.endDate,
      location: event.location,
      phase,
    },
    stats,
    recentCheckIns: feed.map((item) => ({
      id: item.id,
      checkedInAt: item.checkedInAt,
      name: item.name,
      company: item.company,
      ticketType: item.ticketType,
      isVip: item.isVip,
    })),
    alerts,
  });
});
