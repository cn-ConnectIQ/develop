import { EventStatus, EventType, prisma } from "@connectiq/database";
import { ErrorCode } from "@connectiq/types";
import { ApiError } from "@/lib/api-auth";

export const JOIN_CODE_SETTING_KEY = "join_code";

/** 开发/演示用活动码别名 → slug */
const DEMO_CODE_ALIASES: Record<string, string> = {
  DEMO2026: "saas-growth-summit-2025",
  DEMO: "saas-growth-summit-2025",
  CIQ2026: "smart-link-industry-expo-2026",
  "888888": "enterprise-digital-expo-2025",
  TEST1377: "smart-link-industry-expo-2026",
};

export type ApiMobileEventByCode = {
  id: string;
  name: string;
  event_type: string;
  activity_type: string;
  starts_at: string;
  ends_at: string;
  venue?: string;
  city?: string;
  status: "DRAFT" | "PUBLISHED" | "LIVE" | "ENDED";
  cover_url?: string;
  description?: string | null;
  attendee_count?: number;
  org?: {
    name: string;
    logo_url?: string;
    cover_url?: string;
    is_verified?: boolean;
  } | null;
  agenda_summary?: ApiMobileAgendaItem[];
};

export type ApiMobileAgendaItem = {
  id: string;
  title: string;
  room?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  speakers: string[];
};

export function normalizeJoinCode(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, "");
}

function mapEventStatus(status: EventStatus): ApiMobileEventByCode["status"] {
  if (status === EventStatus.ARCHIVED) return "ENDED";
  if (status === EventStatus.LIVE) return "LIVE";
  if (status === EventStatus.PUBLISHED) return "PUBLISHED";
  return "DRAFT";
}

function mapEventType(type: EventType): string {
  switch (type) {
    case EventType.CONFERENCE:
      return "CONFERENCE";
    case EventType.EXPO:
      return "EXPO";
    default:
      return "CONFERENCE";
  }
}

function parseCityVenue(location: string | null): { city?: string; venue?: string } {
  if (!location?.trim()) return {};
  const parts = location.split("·").map((s) => s.trim());
  if (parts.length >= 2) {
    return { city: parts[0], venue: parts.slice(1).join(" · ") };
  }
  return { venue: location.trim() };
}

function settingValueMatches(value: unknown, normalized: string): boolean {
  if (typeof value === "string") {
    return normalizeJoinCode(value) === normalized;
  }
  if (value && typeof value === "object" && "code" in value) {
    return normalizeJoinCode(String((value as { code: string }).code)) === normalized;
  }
  return false;
}

function mapEventRow(
  event: {
    id: string;
    name: string;
    type: EventType;
    activityType: string;
    status: EventStatus;
    location: string | null;
    startDate: Date | null;
    endDate: Date | null;
    description?: string | null;
    org: {
      name: string;
      logoUrl: string | null;
      coverUrl?: string | null;
      isVerified?: boolean;
    } | null;
  },
  extras?: {
    attendee_count?: number;
    agenda_summary?: ApiMobileAgendaItem[];
  },
): ApiMobileEventByCode {
  const { city, venue } = parseCityVenue(event.location);
  const cover =
    event.org?.coverUrl ?? event.org?.logoUrl ?? undefined;
  return {
    id: event.id,
    name: event.name,
    event_type: mapEventType(event.type),
    activity_type: event.activityType,
    starts_at: event.startDate?.toISOString() ?? new Date().toISOString(),
    ends_at: event.endDate?.toISOString() ?? event.startDate?.toISOString() ?? new Date().toISOString(),
    city,
    venue,
    status: mapEventStatus(event.status),
    description: event.description ?? null,
    cover_url: cover ?? undefined,
    attendee_count: extras?.attendee_count,
    org: event.org
      ? {
          name: event.org.name,
          logo_url: event.org.logoUrl ?? undefined,
          cover_url: event.org.coverUrl ?? undefined,
          is_verified: event.org.isVerified ?? false,
        }
      : null,
    agenda_summary: extras?.agenda_summary,
  };
}

const eventInclude = {
  org: {
    select: {
      name: true,
      logoUrl: true,
      coverUrl: true,
      isVerified: true,
    },
  },
} as const;

async function loadEventPublicExtras(eventId: string) {
  const [attendee_count, sessions] = await Promise.all([
    prisma.participant.count({ where: { eventId } }),
    prisma.session.findMany({
      where: { eventId },
      orderBy: { startTime: "asc" },
      take: 12,
      select: {
        id: true,
        title: true,
        room: true,
        startTime: true,
        endTime: true,
        speakers: {
          select: {
            speaker: { select: { name: true } },
          },
        },
      },
    }),
  ]);

  const agenda_summary: ApiMobileAgendaItem[] = sessions.map((row) => ({
    id: row.id,
    title: row.title,
    room: row.room,
    start_time: row.startTime?.toISOString() ?? null,
    end_time: row.endTime?.toISOString() ?? null,
    speakers: row.speakers.map((s) => s.speaker.name),
  }));

  return { attendee_count, agenda_summary };
}

async function loadEventBySlug(slug: string): Promise<ApiMobileEventByCode | null> {
  const event = await prisma.event.findUnique({
    where: { slug },
    include: eventInclude,
  });
  if (!event) return null;
  if (event.status === EventStatus.DRAFT || event.status === EventStatus.ARCHIVED) {
    return null;
  }
  return mapEventRow(event);
}

export async function findEventByJoinCode(code: string): Promise<ApiMobileEventByCode | null> {
  const normalized = normalizeJoinCode(code);
  if (!normalized) return null;

  const aliasSlug = DEMO_CODE_ALIASES[normalized];
  if (aliasSlug) {
    const fromAlias = await loadEventBySlug(aliasSlug);
    if (fromAlias) return fromAlias;
  }

  const settings = await prisma.eventSetting.findMany({
    where: { key: JOIN_CODE_SETTING_KEY },
    select: { eventId: true, value: true },
  });
  const matchedSetting = settings.find((row) => settingValueMatches(row.value, normalized));
  if (matchedSetting) {
    const event = await prisma.event.findUnique({
      where: { id: matchedSetting.eventId },
      include: eventInclude,
    });
    if (event && event.status !== EventStatus.DRAFT && event.status !== EventStatus.ARCHIVED) {
      return mapEventRow(event);
    }
  }

  const slugCandidate = normalized.toLowerCase();
  const bySlug = await loadEventBySlug(slugCandidate);
  if (bySlug) return bySlug;

  const compact = normalized.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (compact.length >= 4) {
    const events = await prisma.event.findMany({
      where: {
        status: { in: [EventStatus.PUBLISHED, EventStatus.LIVE] },
      },
      include: eventInclude,
    });
    const fuzzy = events.find((e) => e.slug.replace(/-/g, "").toUpperCase().startsWith(normalized.slice(0, 8)));
    if (fuzzy) return mapEventRow(fuzzy);
  }

  return null;
}

export async function verifyEventJoinCode(code: string): Promise<ApiMobileEventByCode> {
  const event = await findEventByJoinCode(code);
  if (!event) {
    throw new ApiError("活动码无效或活动未开放", ErrorCode.NOT_FOUND, 404);
  }
  return event;
}

/** 按 ID 读取公开活动（小程序邀请落地 / 活动详情） */
export async function getPublicEventById(
  eventId: string,
): Promise<ApiMobileEventByCode | null> {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: eventInclude,
  });
  if (!event || event.status === EventStatus.DRAFT) return null;

  const extras = await loadEventPublicExtras(eventId);
  return mapEventRow(event, extras);
}
