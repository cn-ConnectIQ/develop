import { ActivityType, EventStatus, prisma } from "@connectiq/database";
import { ErrorCode } from "@connectiq/types";
import { ApiError } from "@/lib/api-auth";
import { countEventsByType } from "@/lib/event-discover-service";

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
};

function mapEventStatus(status: EventStatus): ApiAccountEventItem["status"] {
  if (status === EventStatus.ARCHIVED) return "ENDED";
  if (status === EventStatus.LIVE) return "LIVE";
  if (status === EventStatus.PUBLISHED) return "PUBLISHED";
  return "DRAFT";
}

function buildKeyMetric(
  activityType: ActivityType,
  counts: { participants: number; leads: number; checkIns: number },
): string {
  if (activityType === ActivityType.EXPO || activityType === ActivityType.EXHIBITION) {
    return `${counts.leads} 条线索`;
  }
  if (counts.checkIns > 0) {
    return `${counts.checkIns} 人已签到`;
  }
  return `${counts.participants} 位参会者`;
}

export async function getAccountOverview(orgId: string): Promise<ApiAccountOverview> {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: {
      totalEvents: true,
      totalParticipants: true,
      totalLeads: true,
      totalConnections: true,
    },
  });
  if (!org) {
    throw new ApiError("组织不存在", ErrorCode.NOT_FOUND, 404);
  }

  const events = await prisma.event.findMany({
    where: { orgId },
    select: { activityType: true },
  });

  return {
    totalEvents: org.totalEvents,
    totalParticipants: org.totalParticipants,
    totalLeads: org.totalLeads,
    totalConnections: org.totalConnections,
    eventsByType: countEventsByType(events),
  };
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
  const leadCounts =
    eventIds.length === 0
      ? []
      : await prisma.lead.groupBy({
          by: ["boothId"],
          where: { booth: { eventId: { in: eventIds } } },
          _count: { _all: true },
        });

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

  return events.map((event) => ({
    id: event.id,
    name: event.name,
    activityType: event.activityType,
    status: mapEventStatus(event.status),
    keyMetric: buildKeyMetric(event.activityType, {
      participants: event._count.participants,
      checkIns: event._count.checkIns,
      leads: leadMap.get(event.id) ?? 0,
    }),
  }));
}
