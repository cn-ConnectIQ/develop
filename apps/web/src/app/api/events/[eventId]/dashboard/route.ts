import { prisma } from "@connectiq/database";
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
  const review = await prisma.eventReview.findUnique({ where: { eventId } });
  const phase = getEventPhase(event);
  const { stats, feed, alerts } = await getEventDashboardData(eventId);

  return createSuccessResponse({
    event: {
      id: event.id,
      name: event.name,
      status: event.status,
      reviewStatus: event.reviewStatus,
      review: review
        ? {
            status: review.status,
            revisionNotes: review.revisionNotes,
            rejectionReason: review.rejectionReason,
          }
        : null,
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
