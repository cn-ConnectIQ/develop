import {
  ActivityType,
  prisma,
  PrismaUserRole,
  EventType,
  EventStatus,
} from "@connectiq/database";
import { UserRole as AppUserRole, ErrorCode } from "@connectiq/types";
import { z } from "zod";
import {
  createErrorResponse,
  createSuccessResponse,
  requireAuth,
  withErrorHandler,
} from "@/lib/api-auth";
import {
  listAccountAdminEvents,
} from "@/lib/event-list-service";
import {
  categoryToDbType,
  getEventPhase,
  slugify,
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

  const listed = await listAccountAdminEvents(session);
  let events = listed.events;
  const stats = listed.stats;

  if (statusFilter) {
    events = events.filter((event) => event.status === statusFilter);
  }

  if (phaseFilter && phaseFilter !== "all") {
    events = events.filter((event) => {
      const phase = getEventPhase({
        status: event.status as EventStatus,
        startDate: event.startDate ? new Date(event.startDate) : null,
        endDate: event.endDate ? new Date(event.endDate) : null,
      });
      if (phaseFilter === "upcoming") {
        return phase === "upcoming" || phase === "today";
      }
      return phase === phaseFilter;
    });
  }

  const startIndex = cursor ? events.findIndex((e) => e.id === cursor) + 1 : 0;
  const pageItems = events.slice(startIndex, startIndex + limit);
  const hasNext = startIndex + limit < events.length;
  const nextCursor = hasNext ? pageItems[pageItems.length - 1]?.id : undefined;

  const response = createSuccessResponse(
    { events: pageItems, stats },
    {
      total: listed.events.length,
      cursor: nextCursor ?? null,
      hasNext: Boolean(nextCursor),
    },
  );
  response.headers.set(
    "Cache-Control",
    "private, max-age=30, stale-while-revalidate=120",
  );
  return response;
});

export const POST = withErrorHandler(async (request) => {
  const { session } = await requireAuth([
    AppUserRole.PLATFORM_ADMIN,
    AppUserRole.ORGANIZER,
    AppUserRole.EXPO_ORGANIZER,
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
  const startDate = new Date(data.startDate);
  const endDate = new Date(data.endDate);
  if (endDate <= startDate) {
    return createErrorResponse(
      "结束时间须晚于开始时间",
      ErrorCode.VALIDATION_ERROR,
      400,
    );
  }

  const organizerId = session.user.id;
  const orgId =
    session.user.userType === "ACCOUNT_ADMIN"
      ? session.user.activeOrgId
      : null;

  if (session.user.userType === "ACCOUNT_ADMIN" && !orgId) {
    return createErrorResponse("请先选择组织", ErrorCode.VALIDATION_ERROR, 400);
  }

  let resolvedOrgId = orgId;
  if (!resolvedOrgId) {
    const dbUser = await prisma.user.findUnique({
      where: { id: organizerId },
      select: { orgId: true },
    });
    resolvedOrgId = dbUser?.orgId ?? null;
  }
  if (!resolvedOrgId) {
    return createErrorResponse(
      "缺少组织归属，无法创建活动",
      ErrorCode.VALIDATION_ERROR,
      400,
    );
  }

  const activeOrgType = session.user.activeOrgType;
  // 统一账号模型：已审核组织可创建任意类型活动（由 activityType 区分能力）
  void activeOrgType;

  const activityType =
    data.type === EventType.EXPO ? ActivityType.EXPO : ActivityType.CONFERENCE;

  const event = await prisma.event.create({
    data: {
      name: data.name,
      slug: slugify(data.name),
      type: data.type,
      activityType,
      status: EventStatus.DRAFT,
      description: data.description,
      location: data.location,
      startDate,
      endDate,
      organizerId,
      orgId: resolvedOrgId,
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

  if (orgId) {
    await prisma.organization.update({
      where: { id: orgId },
      data: { eventCount: { increment: 1 } },
    });
  }

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
