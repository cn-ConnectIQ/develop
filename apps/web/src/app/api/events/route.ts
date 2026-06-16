import { prisma, PrismaUserRole, EventType, EventStatus } from "@connectiq/database";
import { UserRole as AppUserRole, ErrorCode } from "@connectiq/types";
import { z } from "zod";
import {
  createErrorResponse,
  createSuccessResponse,
  requireAuth,
  withErrorHandler,
} from "@/lib/api-auth";
import {
  categoryToDbType,
  computeEventReadiness,
  getEventPhase,
  slugify,
  type EventCategory,
} from "@/lib/event-utils";

const eventCategorySchema = z.enum(["SUMMIT", "EXPO", "SALON", "TRAINING"]);

const createEventBodySchema = z.object({
  name: z.string().min(2, "活动名称至少 2 个字符"),
  type: z.nativeEnum(EventType).optional(),
  event_type: z.nativeEnum(EventType).optional(),
  category: eventCategorySchema.optional(),
  startDate: z.string().datetime({ message: "请选择开始时间" }).optional(),
  endDate: z.string().datetime({ message: "请选择结束时间" }).optional(),
  starts_at: z.string().datetime({ message: "请选择开始时间" }).optional(),
  ends_at: z.string().datetime({ message: "请选择结束时间" }).optional(),
  location: z.string().optional(),
  city: z.string().optional(),
  venue: z.string().optional(),
  description: z.string().optional(),
});

function parseCreateEventBody(body: unknown) {
  const parsed = createEventBodySchema.safeParse(body);
  if (!parsed.success) return parsed;

  const data = parsed.data;
  const startRaw = data.startDate ?? data.starts_at;
  const endRaw = data.endDate ?? data.ends_at;
  if (!startRaw || !endRaw) {
    return {
      success: false as const,
      error: { issues: [{ message: "请选择开始和结束时间", path: ["startDate"] }] },
    };
  }

  const type =
    data.type ??
    data.event_type ??
    (data.category ? categoryToDbType(data.category) : EventType.CONFERENCE);

  const locationParts = [data.city?.trim(), data.venue?.trim()].filter(Boolean);
  const location =
    data.location?.trim() ||
    (locationParts.length > 0 ? locationParts.join(" · ") : undefined);

  return {
    success: true as const,
    data: {
      name: data.name,
      type,
      category: data.category,
      startDate: startRaw,
      endDate: endRaw,
      location,
      description: data.description,
    },
  };
}

function buildOrganizerWhere(session: { user: { id: string; role: AppUserRole } }) {
  if (session.user.role === AppUserRole.PLATFORM_ADMIN) {
    return {};
  }
  if (session.user.role === AppUserRole.EXPO_ORGANIZER) {
    return { organizerId: session.user.id, type: EventType.EXPO };
  }
  return { organizerId: session.user.id };
}

function serializeEvent(
  event: Awaited<ReturnType<typeof prisma.event.findMany>>[number] & {
    _count: {
      participants: number;
      checkIns: number;
      ticketTypes: number;
      polls: number;
      sessions: number;
    };
    settings: Array<{ value: unknown }>;
    review?: {
      status: string;
      revisionNotes: string | null;
      rejectionReason: string | null;
    } | null;
  },
) {
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

  return {
    id: event.id,
    name: event.name,
    slug: event.slug,
    type: event.type,
    category,
    status: event.status,
    reviewStatus: event.reviewStatus,
    description: event.description,
    location: event.location,
    startDate: event.startDate?.toISOString() ?? null,
    endDate: event.endDate?.toISOString() ?? null,
    createdAt: event.createdAt.toISOString(),
    review: event.review
      ? {
          status: event.review.status,
          revisionNotes: event.review.revisionNotes,
          rejectionReason: event.review.rejectionReason,
        }
      : null,
    readiness,
    _count: {
      participants: event._count.participants,
      checkIns: event._count.checkIns,
      ticketTypes: event._count.ticketTypes,
      polls: event._count.polls,
      sessions: event._count.sessions,
    },
  };
}

export const GET = withErrorHandler(async (request) => {
  const { session } = await requireAuth([
    AppUserRole.PLATFORM_ADMIN,
    AppUserRole.ORGANIZER,
    AppUserRole.EXPO_ORGANIZER,
  ]);

  const { searchParams } = new URL(request.url);
  const statusFilter = searchParams.get("status") as EventStatus | null;
  const phaseFilter = searchParams.get("phase");
  const cursor = searchParams.get("cursor");
  const limit = Math.min(Math.max(Number(searchParams.get("limit") ?? 50), 1), 100);

  const baseWhere = buildOrganizerWhere(session);
  const where = {
    ...baseWhere,
    ...(statusFilter ? { status: statusFilter } : {}),
  };

  const allForStats = await prisma.event.findMany({
    where: baseWhere,
    select: { status: true, startDate: true, endDate: true },
  });

  const stats = {
    live: 0,
    today: 0,
    upcoming: 0,
    draft: 0,
    ended: 0,
  };

  for (const event of allForStats) {
    const phase = getEventPhase(event);
    stats[phase]++;
  }

  let events = await prisma.event.findMany({
    where,
    orderBy: [{ startDate: "asc" }, { createdAt: "desc" }],
    include: {
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
    },
  });

  if (phaseFilter && phaseFilter !== "all") {
    events = events.filter((event) => {
      const phase = getEventPhase(event);
      if (phaseFilter === "upcoming") {
        return phase === "upcoming" || phase === "today";
      }
      return phase === phaseFilter;
    });
  }

  const startIndex = cursor
    ? events.findIndex((e) => e.id === cursor) + 1
    : 0;
  const pageItems = events.slice(startIndex, startIndex + limit);
  const hasNext = startIndex + limit < events.length;
  const nextCursor = hasNext ? pageItems[pageItems.length - 1]?.id : undefined;

  return createSuccessResponse(
    {
      events: pageItems.map(serializeEvent),
      stats,
    },
    {
      total: allForStats.length,
      cursor: nextCursor ?? null,
      hasNext: Boolean(nextCursor),
    },
  );
});

export const POST = withErrorHandler(async (request) => {
  const { session } = await requireAuth([
    AppUserRole.PLATFORM_ADMIN,
    AppUserRole.ORGANIZER,
  ]);

  const body = await request.json();
  const parsed = parseCreateEventBody(body);
  if (!parsed.success) {
    return createErrorResponse(
      parsed.error.issues[0]?.message ?? "参数校验失败",
      ErrorCode.VALIDATION_ERROR,
      400,
    );
  }

  const data = parsed.data;
  const organizerId = session.user.id;

  const event = await prisma.event.create({
    data: {
      name: data.name,
      slug: slugify(data.name),
      type: data.type,
      status: EventStatus.DRAFT,
      description: data.description,
      location: data.location,
      startDate: new Date(data.startDate),
      endDate: new Date(data.endDate),
      organizerId,
      ...(data.category
        ? {
            settings: {
              create: {
                key: "event_category",
                value: data.category,
              },
            },
          }
        : {}),
    },
  });

  const assignmentRole =
    data.type === EventType.EXPO ? PrismaUserRole.EXPO_ORGANIZER : PrismaUserRole.ORGANIZER;

  await prisma.userRoleAssignment.upsert({
    where: {
      userId_role_entityId: {
        userId: session.user.id,
        role: assignmentRole,
        entityId: event.id,
      },
    },
    create: {
      userId: session.user.id,
      role: assignmentRole,
      entityId: event.id,
    },
    update: {},
  });

  return createSuccessResponse({
    id: event.id,
    name: event.name,
    slug: event.slug,
    type: event.type,
    status: event.status,
    startDate: event.startDate?.toISOString() ?? null,
    endDate: event.endDate?.toISOString() ?? null,
    location: event.location,
  });
});
