import { EventType, EventStatus, prisma } from "@connectiq/database";
import { UserRole as AppUserRole } from "@connectiq/types";
import type { Session } from "next-auth";
import type { EventFeatureFlags } from "@/lib/event-feature-flags";
import {
  parseEventFeatureFlags,
  toApiFeatureFlags,
} from "@/lib/event-feature-flags";
import {
  computeEventReadiness,
  getEventPhase,
  type EventCategory,
} from "@/lib/event-utils";
import type { EventListItem, EventListResponse } from "@/hooks/useEvents";

const eventListInclude = (activeOrgId?: string | null) => ({
  org: {
    select: {
      id: true,
      name: true,
      slug: true,
      logoUrl: true,
      isVerified: true,
    },
  },
  _count: {
    select: {
      participants: true,
      checkIns: true,
      ticketTypes: true,
      polls: true,
      sessions: true,
    },
  },
  settings: {
    where: { key: "event_category" },
    take: 1,
    select: { value: true },
  },
  review: {
    select: {
      status: true,
      revisionNotes: true,
      rejectionReason: true,
    },
  },
  ...(activeOrgId
    ? {
        booths: {
          where: { companyOrgId: activeOrgId },
          select: { id: true, code: true, name: true },
          take: 1,
        },
      }
    : {}),
});

type RawEvent = {
  settings: Array<{ value: unknown }>;
  booths?: Array<{ id: string; code: string; name: string }>;
  org: {
    id: string;
    name: string;
    slug: string;
    logoUrl: string | null;
    isVerified: boolean;
  } | null;
  _count: {
    participants: number;
    checkIns: number;
    ticketTypes: number;
    polls: number;
    sessions: number;
  };
  review: {
    status: string;
    revisionNotes: string | null;
    rejectionReason: string | null;
  } | null;
  orgId: string | null;
  id: string;
  name: string;
  slug: string;
  type: string;
  activityType: string;
  status: EventStatus;
  reviewStatus: string;
  description: string | null;
  location: string | null;
  startDate: Date | null;
  endDate: Date | null;
  createdAt: Date;
  featureFlags: unknown;
};

export function buildOrganizerWhere(session: Session) {
  if (session.user.role === AppUserRole.PLATFORM_ADMIN) {
    return {};
  }

  const userId = session.user.id;
  const role = session.user.role;
  const activeOrgId = session.user.activeOrgId;

  if (activeOrgId) {
    const participated = {
      booths: { some: { companyOrgId: activeOrgId } },
    };
    if (role === AppUserRole.EXPO_ORGANIZER) {
      return {
        OR: [
          { orgId: activeOrgId, type: EventType.EXPO },
          { ...participated, type: EventType.EXPO },
        ],
      };
    }
    return {
      OR: [{ orgId: activeOrgId }, participated],
    };
  }

  if (role === AppUserRole.EXPO_ORGANIZER) {
    return { organizerId: userId, type: EventType.EXPO };
  }

  return { organizerId: userId };
}

export function serializeEventListItem(
  event: RawEvent,
  activeOrgId?: string | null,
): EventListItem {
  const categorySetting = event.settings[0]?.value;
  const category =
    typeof categorySetting === "string"
      ? (categorySetting as EventCategory)
      : null;

  const readiness = computeEventReadiness({
    name: event.name,
    status: event.status,
    location: event.location,
    description: event.description,
    startDate: event.startDate,
    endDate: event.endDate,
    _count: event._count,
  });

  const isHost = !activeOrgId || event.orgId === activeOrgId;
  const participatingBooth = event.booths?.[0] ?? null;
  const listRole = isHost ? "HOST" : "EXHIBITOR";

  return {
    id: event.id,
    name: event.name,
    slug: event.slug,
    type: event.type,
    activityType: event.activityType,
    category,
    status: event.status,
    reviewStatus: event.reviewStatus,
    description: event.description,
    location: event.location,
    startDate: event.startDate?.toISOString() ?? null,
    endDate: event.endDate?.toISOString() ?? null,
    createdAt: event.createdAt.toISOString(),
    listRole,
    boothId: listRole === "EXHIBITOR" ? participatingBooth?.id ?? null : null,
    boothCode: listRole === "EXHIBITOR" ? participatingBooth?.code ?? null : null,
    review: event.review
      ? {
          status: event.review.status,
          revisionNotes: event.review.revisionNotes,
          rejectionReason: event.review.rejectionReason,
        }
      : null,
    readiness,
    org: event.org
      ? {
          id: event.org.id,
          name: event.org.name,
          slug: event.org.slug,
          logo_url: event.org.logoUrl,
          is_verified: event.org.isVerified,
        }
      : null,
    featureFlags: toApiFeatureFlags(parseEventFeatureFlags(event.featureFlags)),
    _count: {
      participants: event._count.participants,
      checkIns: event._count.checkIns,
      ticketTypes: event._count.ticketTypes,
      polls: event._count.polls,
      sessions: event._count.sessions,
    },
  };
}

function computeEventStats(
  rows: Array<{ status: EventStatus; startDate: Date | null; endDate: Date | null }>,
) {
  const stats = { live: 0, today: 0, upcoming: 0, draft: 0, ended: 0 };
  for (const event of rows) {
    stats[getEventPhase(event)]++;
  }
  return stats;
}

/** 账号管理员活动列表（layout 预取 + API 共用） */
export async function listAccountAdminEvents(
  session: Session,
): Promise<EventListResponse> {
  const baseWhere = buildOrganizerWhere(session);
  const activeOrgId = session.user.activeOrgId;

  const [allForStats, events] = await Promise.all([
    prisma.event.findMany({
      where: baseWhere,
      select: { status: true, startDate: true, endDate: true },
    }),
    prisma.event.findMany({
      where: baseWhere,
      orderBy: [{ startDate: "asc" }, { createdAt: "desc" }],
      include: eventListInclude(activeOrgId),
    }),
  ]);

  return {
    events: events.map((event) => serializeEventListItem(event, activeOrgId)),
    stats: computeEventStats(allForStats),
  };
}
