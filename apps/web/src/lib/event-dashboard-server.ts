import { prisma } from "@connectiq/database";
import { requireEventAccessCheck } from "@/lib/api-auth";
import { getEventManageOverview } from "@/lib/account-manage-overview-service";
import { emptyDashboardData, getEventDashboardData } from "@/lib/dashboard";
import type { DashboardAlert, DashboardInsights } from "@/lib/dashboard-types";
import type { EventDashboardPayload } from "@/lib/event-dashboard-types";
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

export async function loadEventDashboardPayload(
  eventId: string,
): Promise<EventDashboardPayload | null> {
  const access = await requireEventAccessCheck(eventId);
  if ("error" in access) return null;

  const { event, orgId } = access;
  const review = await prisma.eventReview.findUnique({ where: { eventId } });
  const phase = getEventPhase(event);

  let statsFeedAlerts: Awaited<ReturnType<typeof getEventDashboardData>>;
  try {
    statsFeedAlerts = await getEventDashboardData(eventId);
  } catch (err) {
    console.error("[event-dashboard] stats load failed:", err);
    statsFeedAlerts = emptyDashboardData();
  }

  const insights = await loadDashboardInsights(orgId, eventId);
  const { stats, feed, alerts } = statsFeedAlerts;

  const mergedAlerts: DashboardAlert[] = [...alerts];
  if (insights?.pendingExhibitors?.length) {
    mergedAlerts.unshift({
      id: "pending-exhibitors",
      message: `待审展商 ${insights.pendingExhibitors.length} 家`,
      href: "exhibitors/booths#reviews",
    });
  }

  return {
    event: {
      id: event.id,
      name: event.name,
      phase,
      reviewStatus: event.reviewStatus ?? null,
      review: review
        ? {
            status: review.status,
            revisionNotes: review.revisionNotes,
            rejectionReason: review.rejectionReason,
          }
        : null,
      startDate: event.startDate?.toISOString() ?? null,
      endDate: event.endDate?.toISOString() ?? null,
    },
    stats,
    insights,
    recentCheckIns: feed.map((item) => ({
      id: item.id,
      checkedInAt: item.checkedInAt.toISOString(),
      name: item.name,
      company: item.company,
      ticketType: item.ticketType,
      isVip: item.isVip,
    })),
    alerts: mergedAlerts,
  } satisfies EventDashboardPayload;
}

export type { EventDashboardPayload } from "@/lib/event-dashboard-types";
