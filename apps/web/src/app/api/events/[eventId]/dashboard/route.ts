import { prisma } from "@connectiq/database";
import { ErrorCode } from "@connectiq/types";
import {
  createErrorResponse,
  createSuccessResponse,
  requireEventAccess,
  withErrorHandler,
} from "@/lib/api-auth";
import { getEventDashboardData } from "@/lib/dashboard";
import type { DashboardAlert, DashboardInsights } from "@/lib/dashboard-types";
import { getEventManageOverview } from "@/lib/account-manage-overview-service";
import { getEventPhase } from "@/lib/event-utils";

async function loadDashboardInsights(
  orgId: string | null,
  eventId: string,
): Promise<DashboardInsights | null> {
  if (!orgId) return null;
  try {
    const overview = await getEventManageOverview(orgId, eventId);
    if (overview.kind === "CONFERENCE") {
      return overview.peak_insight
        ? { peakInsight: overview.peak_insight }
        : null;
    }
    if (overview.kind === "EXPO") {
      return {
        pendingExhibitors: overview.pending_exhibitors,
        boothRankings: overview.booth_rankings.slice(0, 5),
      };
    }
  } catch {
    // 概览增强数据加载失败时不影响主工作台
  }
  return null;
}

export const GET = withErrorHandler(async (_request, context) => {
  const eventId = context?.params?.eventId;
  if (!eventId) {
    return createErrorResponse("缺少活动 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  const { event } = await requireEventAccess(eventId);
  const review = await prisma.eventReview.findUnique({ where: { eventId } });
  const phase = getEventPhase(event);
  const [{ stats, feed, alerts }, insights] = await Promise.all([
    getEventDashboardData(eventId),
    loadDashboardInsights(event.orgId, eventId),
  ]);

  const mergedAlerts: DashboardAlert[] = [...alerts];
  if (insights?.pendingExhibitors?.length) {
    mergedAlerts.unshift({
      id: "pending-exhibitors",
      message: `待审展商 ${insights.pendingExhibitors.length} 家`,
      href: "exhibitors/booths#reviews",
    });
  }

  return createSuccessResponse({
    event: {
      id: event.id,
      name: event.name,
      status: event.status,
      activityType: event.activityType,
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
    insights,
    recentCheckIns: feed.map((item) => ({
      id: item.id,
      checkedInAt: item.checkedInAt,
      name: item.name,
      company: item.company,
      ticketType: item.ticketType,
      isVip: item.isVip,
    })),
    alerts: mergedAlerts,
  });
});
