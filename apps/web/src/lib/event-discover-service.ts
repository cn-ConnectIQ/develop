import {
  ActivityType,
  EventStatus,
  prisma,
} from "@connectiq/database";
import { findParticipantForUser } from "@/lib/interaction/participant-user";

export type ApiDiscoverRecentEvent = {
  id: string;
  name: string;
  logo: string | null;
  status: "DRAFT" | "PUBLISHED" | "LIVE" | "ENDED";
  activityType: string;
  /** AI2 · 商机密度 0–100 */
  opportunity_density: number;
};

export type ApiDiscoverNearbyEvent = {
  id: string;
  name: string;
  date: string | null;
  location: string | null;
  canRegister: boolean;
  /** AI2 · 商机密度 0–100 */
  opportunity_density: number;
};

export type ApiEventDiscover = {
  recent: ApiDiscoverRecentEvent[];
  nearby: ApiDiscoverNearbyEvent[];
};

function mapEventStatus(status: EventStatus): ApiDiscoverRecentEvent["status"] {
  if (status === EventStatus.ARCHIVED) return "ENDED";
  if (status === EventStatus.LIVE) return "LIVE";
  if (status === EventStatus.PUBLISHED) return "PUBLISHED";
  return "DRAFT";
}

function formatEventDate(startDate: Date | null, endDate: Date | null): string | null {
  if (!startDate) return null;
  const start = startDate.toISOString().slice(0, 10);
  if (!endDate) return start;
  const end = endDate.toISOString().slice(0, 10);
  return start === end ? start : `${start} ~ ${end}`;
}

type EventDensityInput = {
  status: EventStatus;
  participantCount: number;
  intentCount: number;
  connectionCount: number;
};

/** 基于规模与互动信号的商机密度启发式（0–100） */
export function computeOpportunityDensity(input: EventDensityInput): number {
  let score = 38;
  if (input.status === EventStatus.LIVE) score += 28;
  else if (input.status === EventStatus.PUBLISHED) score += 12;

  if (input.participantCount >= 200) score += 18;
  else if (input.participantCount >= 80) score += 14;
  else if (input.participantCount >= 30) score += 10;
  else if (input.participantCount >= 10) score += 6;
  else if (input.participantCount >= 3) score += 3;

  score += Math.min(12, Math.round(input.intentCount / 4));
  score += Math.min(8, Math.round(input.connectionCount / 5));

  return Math.min(100, Math.max(0, Math.round(score)));
}

async function loadEventDensityMaps(eventIds: string[]) {
  if (eventIds.length === 0) {
    return {
      participants: new Map<string, number>(),
      intents: new Map<string, number>(),
      connections: new Map<string, number>(),
    };
  }

  const [participantRows, intentRows, connectionRows] = await Promise.all([
    prisma.participant.groupBy({
      by: ["eventId"],
      where: { eventId: { in: eventIds } },
      _count: { _all: true },
    }),
    prisma.userEventIntent.groupBy({
      by: ["eventId"],
      where: { eventId: { in: eventIds } },
      _count: { _all: true },
    }),
    prisma.businessConnection.groupBy({
      by: ["eventId"],
      where: {
        eventId: { in: eventIds },
        status: "ACTIVE",
      },
      _count: { _all: true },
    }),
  ]);

  return {
    participants: new Map(
      participantRows.map((row) => [row.eventId, row._count._all]),
    ),
    intents: new Map(intentRows.map((row) => [row.eventId, row._count._all])),
    connections: new Map(
      connectionRows
        .filter((row): row is typeof row & { eventId: string } =>
          Boolean(row.eventId),
        )
        .map((row) => [row.eventId, row._count._all]),
    ),
  };
}

function densityForEvent(
  eventId: string,
  status: EventStatus,
  maps: Awaited<ReturnType<typeof loadEventDensityMaps>>,
): number {
  return computeOpportunityDensity({
    status,
    participantCount: maps.participants.get(eventId) ?? 0,
    intentCount: maps.intents.get(eventId) ?? 0,
    connectionCount: maps.connections.get(eventId) ?? 0,
  });
}

async function loadUserEventIds(userId: string): Promise<string[]> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, phone: true },
  });
  if (!user) return [];

  const or: Array<{ email?: string; phone?: string }> = [];
  if (user.email) or.push({ email: user.email });
  if (user.phone) or.push({ phone: user.phone });

  const [participants, intents] = await Promise.all([
    or.length > 0
      ? prisma.participant.findMany({
          where: { OR: or },
          select: { eventId: true, createdAt: true },
          orderBy: { createdAt: "desc" },
        })
      : Promise.resolve([]),
    prisma.userEventIntent.findMany({
      where: { userId },
      select: { eventId: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  const seen = new Map<string, number>();
  for (const row of participants) {
    seen.set(row.eventId, row.createdAt.getTime());
  }
  for (const row of intents) {
    const prev = seen.get(row.eventId) ?? 0;
    seen.set(row.eventId, Math.max(prev, row.updatedAt.getTime()));
  }

  return [...seen.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([eventId]) => eventId);
}

export async function getEventDiscover(
  userId?: string | null,
): Promise<ApiEventDiscover> {
  const recentIds = userId ? await loadUserEventIds(userId) : [];

  const recentEvents =
    recentIds.length === 0
      ? []
      : await prisma.event.findMany({
          where: { id: { in: recentIds.slice(0, 12) } },
          include: {
            org: { select: { logoUrl: true } },
          },
        });

  const recentMap = new Map(recentEvents.map((e) => [e.id, e]));
  const recentEventRows = recentIds
    .map((id) => recentMap.get(id))
    .filter((e): e is NonNullable<typeof e> => Boolean(e));

  const joinedSet = new Set(recentIds);
  const nearbyRows = await prisma.event.findMany({
    where: {
      status: { in: [EventStatus.PUBLISHED, EventStatus.LIVE] },
      id: joinedSet.size > 0 ? { notIn: [...joinedSet] } : undefined,
    },
    orderBy: [{ status: "desc" }, { startDate: "asc" }],
    take: 12,
    select: {
      id: true,
      name: true,
      location: true,
      startDate: true,
      endDate: true,
      status: true,
    },
  });

  const densityEventIds = [
    ...new Set([
      ...recentEventRows.map((event) => event.id),
      ...nearbyRows.map((event) => event.id),
    ]),
  ];
  const densityMaps = await loadEventDensityMaps(densityEventIds);

  const recent: ApiDiscoverRecentEvent[] = recentEventRows.map((event) => ({
    id: event.id,
    name: event.name,
    logo: event.org?.logoUrl ?? null,
    status: mapEventStatus(event.status),
    activityType: event.activityType,
    opportunity_density: densityForEvent(
      event.id,
      event.status,
      densityMaps,
    ),
  }));

  const nearby: ApiDiscoverNearbyEvent[] = await Promise.all(
    nearbyRows.map(async (event) => {
      const participant = userId
        ? await findParticipantForUser(event.id, userId)
        : null;
      const canRegister =
        (event.status === EventStatus.PUBLISHED ||
          event.status === EventStatus.LIVE) &&
        !participant;

      return {
        id: event.id,
        name: event.name,
        date: formatEventDate(event.startDate, event.endDate),
        location: event.location,
        canRegister,
        opportunity_density: densityForEvent(
          event.id,
          event.status,
          densityMaps,
        ),
      };
    }),
  );

  return { recent, nearby };
}

export function countEventsByType(
  events: Array<{ activityType: ActivityType }>,
): { conference: number; expo: number; exhibition: number } {
  return events.reduce(
    (acc, event) => {
      if (event.activityType === ActivityType.CONFERENCE) acc.conference += 1;
      else if (event.activityType === ActivityType.EXPO) acc.expo += 1;
      else if (event.activityType === ActivityType.EXHIBITION) acc.exhibition += 1;
      return acc;
    },
    { conference: 0, expo: 0, exhibition: 0 },
  );
}
