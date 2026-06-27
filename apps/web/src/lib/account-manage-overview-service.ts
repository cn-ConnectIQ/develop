import {
  ActivityType,
  ConnectionStatus,
  EventStatus,
  prisma,
} from "@connectiq/database";
import { ErrorCode } from "@connectiq/types";
import { ApiError } from "@/lib/api-auth";
import { getBoothRankings } from "@/lib/booth-rankings-service";
import { calcCheckinRate } from "@/lib/checkin";
import { listRecommendedBuyers } from "@/lib/exhibitor/dashboard-service";

export type ManageOverviewKind = "CONFERENCE" | "EXPO" | "BOOTH";

function mapEventStatus(status: EventStatus): "DRAFT" | "PUBLISHED" | "LIVE" | "ENDED" {
  if (status === EventStatus.ARCHIVED) return "ENDED";
  if (status === EventStatus.LIVE) return "LIVE";
  if (status === EventStatus.PUBLISHED) return "PUBLISHED";
  return "DRAFT";
}

function mapActivityKind(activityType: ActivityType): ManageOverviewKind {
  if (activityType === ActivityType.EXPO) return "EXPO";
  if (activityType === ActivityType.EXHIBITION) return "BOOTH";
  return "CONFERENCE";
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

async function loadBaseCounts(eventId: string) {
  const todayStart = startOfToday();
  const [total_registered, checked_in, connections, interaction_participations] =
    await Promise.all([
      prisma.participant.count({ where: { eventId } }),
      prisma.checkIn.count({ where: { eventId } }),
      prisma.businessConnection.count({
        where: { eventId, status: ConnectionStatus.ACTIVE },
      }),
      prisma.pollResponse.count({
        where: { poll: { eventId }, createdAt: { gte: todayStart } },
      }),
    ]);

  const checkin_rate = calcCheckinRate(checked_in, total_registered);

  return {
    total_registered,
    checked_in,
    checkin_rate,
    on_site: checked_in,
    connections,
    interaction_participations,
  };
}

export async function getEventManageOverview(orgId: string, eventId: string) {
  const event = await prisma.event.findFirst({
    where: { id: eventId, orgId },
    select: {
      id: true,
      name: true,
      activityType: true,
      status: true,
    },
  });

  if (!event) {
    throw new ApiError("活动不存在或无权访问", ErrorCode.NOT_FOUND, 404);
  }

  const status = mapEventStatus(event.status);
  const base = await loadBaseCounts(eventId);
  const kind = mapActivityKind(event.activityType);

  if (kind === "CONFERENCE") {
    return {
      kind: "CONFERENCE" as const,
      event_id: event.id,
      event_name: event.name,
      status,
      ...base,
      peak_insight:
        base.connections > 0
          ? `已建立 ${base.connections} 个连接，互动参与 ${base.interaction_participations} 人次`
          : undefined,
    };
  }

  if (kind === "EXPO") {
    const rankings = await getBoothRankings(eventId);
    const booth_rankings = rankings.rankings.slice(0, 8).map((b, index) => ({
      booth_id: b.booth_id,
      booth_name: b.company_name,
      booth_code: b.booth_number,
      heat: b.today_visitors * 10 + b.total_visitors,
      tag:
        index === 0
          ? ("hottest" as const)
          : index === rankings.rankings.length - 1 && rankings.rankings.length > 3
            ? ("coldest" as const)
            : undefined,
    }));

    const pendingRows = await prisma.exhibitorBooth.findMany({
      where: { eventId, operatorUserId: null },
      select: {
        id: true,
        code: true,
        companyOrg: { select: { name: true } },
      },
      take: 10,
    });

    return {
      kind: "EXPO" as const,
      event_id: event.id,
      event_name: event.name,
      status,
      ...base,
      booth_heat_total: booth_rankings.reduce((sum, b) => sum + b.heat, 0),
      booth_rankings,
      pending_exhibitors: pendingRows.map((row) => ({
        id: row.id,
        company_name: row.companyOrg.name,
        booth_code: row.code,
        status: "PENDING" as const,
      })),
    };
  }

  const booth = await prisma.exhibitorBooth.findFirst({
    where: { eventId, companyOrgId: orgId },
    orderBy: { createdAt: "asc" },
    select: { id: true, code: true, name: true, operatorUserId: true },
  });

  const targetBooth =
    booth ??
    (await prisma.exhibitorBooth.findFirst({
      where: { eventId },
      orderBy: { createdAt: "asc" },
      select: { id: true, code: true, name: true, operatorUserId: true },
    }));

  const boothId = targetBooth?.id;
  const todayStart = startOfToday();

  const [visitors_today, leads_captured, interaction_participants, buyers] =
    await Promise.all([
      boothId
        ? prisma.boothVisitSignal.count({
            where: {
              eventId,
              entityId: boothId,
              occurredAt: { gte: todayStart },
            },
          })
        : Promise.resolve(0),
      boothId
        ? prisma.lead.count({ where: { boothId } })
        : Promise.resolve(0),
      boothId
        ? prisma.lotteryEntry.count({
            where: {
              lottery: { eventId, boothId },
              enteredAt: { gte: todayStart },
            },
          })
        : Promise.resolve(0),
      boothId
        ? listRecommendedBuyers(
            boothId,
            eventId,
            targetBooth?.operatorUserId ?? null,
            20,
          )
        : Promise.resolve([]),
    ]);

  return {
    kind: "BOOTH" as const,
    event_id: event.id,
    event_name: targetBooth ? `${targetBooth.name} · ${targetBooth.code}` : event.name,
    booth_id: boothId,
    booth_code: targetBooth?.code ?? "—",
    booth_label: targetBooth?.name,
    status,
    visitors_today,
    leads_captured,
    interaction_participants,
    ai_buyers_count: buyers.length,
  };
}
