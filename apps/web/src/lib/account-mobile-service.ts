import {
  ActivityType,
  ConnectionStatus,
  EventStatus,
  prisma,
} from "@connectiq/database";
import { calcCheckinRate } from "@/lib/checkin";

export type ApiAccountOverview = {
  totalEvents: number;
  totalParticipants: number;
  totalLeads: number;
  totalConnections: number;
  eventsByType: { conference: number; expo: number; exhibition: number };
};

export type ApiAccountEventItem = {
  id: string;
  name: string;
  activityType: string;
  status: "DRAFT" | "PUBLISHED" | "LIVE" | "ENDED";
  keyMetric: string;
  startsAt?: string;
  endsAt?: string;
  city?: string;
  venue?: string;
  checkinRate: number;
  onSite: number;
  connections: number;
};

function mapEventStatus(status: EventStatus): ApiAccountEventItem["status"] {
  if (status === EventStatus.ARCHIVED) return "ENDED";
  if (status === EventStatus.LIVE) return "LIVE";
  if (status === EventStatus.PUBLISHED) return "PUBLISHED";
  return "DRAFT";
}

function mapActivityTypeForMobile(activityType: ActivityType): string {
  if (activityType === ActivityType.EXHIBITION) return "BOOTH";
  return activityType;
}

function buildKeyMetric(
  activityType: ActivityType,
  counts: { participants: number; leads: number; checkIns: number; connections: number },
): string {
  if (activityType === ActivityType.EXPO || activityType === ActivityType.EXHIBITION) {
    if (counts.leads > 0) return `${counts.leads} 条线索`;
  }
  if (counts.checkIns > 0) {
    return `${counts.checkIns} 人已签到`;
  }
  if (counts.connections > 0) {
    return `${counts.connections} 个连接`;
  }
  return `${counts.participants} 位参会者`;
}

export async function getAccountOverview(orgId: string): Promise<ApiAccountOverview> {
  const { refreshAndGetAccountOverview } = await import(
    "@/lib/org-account-center-service"
  );
  return refreshAndGetAccountOverview(orgId);
}

export async function listAccountEvents(orgId: string): Promise<ApiAccountEventItem[]> {
  const events = await prisma.event.findMany({
    where: { orgId },
    orderBy: { startDate: "desc" },
    include: {
      _count: {
        select: {
          participants: true,
          checkIns: true,
        },
      },
    },
  });

  const eventIds = events.map((e) => e.id);
  if (eventIds.length === 0) return [];

  const [connectionRows, leadCounts] = await Promise.all([
    prisma.businessConnection.groupBy({
      by: ["eventId"],
      where: { eventId: { in: eventIds }, status: ConnectionStatus.ACTIVE },
      _count: { _all: true },
    }),
    prisma.lead.groupBy({
      by: ["boothId"],
      where: { booth: { eventId: { in: eventIds } } },
      _count: { _all: true },
    }),
  ]);

  const connectionMap = new Map(
    connectionRows.map((r) => [r.eventId, r._count._all]),
  );

  const boothEventRows =
    leadCounts.length === 0
      ? []
      : await prisma.exhibitorBooth.findMany({
          where: { id: { in: leadCounts.map((r) => r.boothId) } },
          select: { id: true, eventId: true },
        });
  const boothEventMap = new Map(boothEventRows.map((b) => [b.id, b.eventId]));
  const leadMap = new Map<string, number>();
  for (const row of leadCounts) {
    const eventId = boothEventMap.get(row.boothId);
    if (!eventId) continue;
    leadMap.set(eventId, (leadMap.get(eventId) ?? 0) + row._count._all);
  }

  return events.map((event) => {
    const checkedIn = event._count.checkIns;
    const totalRegistered = event._count.participants;
    const connections = connectionMap.get(event.id) ?? 0;
    const checkinRate = calcCheckinRate(checkedIn, totalRegistered);

    return {
      id: event.id,
      name: event.name,
      activityType: mapActivityTypeForMobile(event.activityType),
      status: mapEventStatus(event.status),
      startsAt: event.startDate?.toISOString(),
      endsAt: event.endDate?.toISOString(),
      venue: event.location ?? undefined,
      checkinRate,
      onSite: checkedIn,
      connections,
      keyMetric: buildKeyMetric(event.activityType, {
        participants: totalRegistered,
        checkIns: checkedIn,
        leads: leadMap.get(event.id) ?? 0,
        connections,
      }),
    };
  });
}
