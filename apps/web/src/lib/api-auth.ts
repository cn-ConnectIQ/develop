import { prisma, PrismaUserRole as DbUserRole } from "@connectiq/database";
import { ErrorCode, UserRole } from "@connectiq/types";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions, hasAnyRole } from "@/lib/auth";
import { errorResponse, successResponse } from "@connectiq/utils";

/** 鉴权失败时抛出，由 withErrorHandler 统一转换为标准错误响应 */
export class ApiError extends Error {
  constructor(
    message: string,
    public code: ErrorCode,
    public status: number,
  ) {
    super(message);
  }
}

export type AuthSession = {
  user: {
    id: string;
    email?: string | null;
    name?: string | null;
    role: UserRole;
    entityId: string | null;
  };
};

export type AuthResult = {
  session: AuthSession;
  user: AuthSession["user"];
};

export type SuccessMeta = {
  total?: number;
  page?: number;
  cursor?: string | null;
  hasNext?: boolean;
  hasPrev?: boolean;
  /** 业务扩展字段（如签到统计） */
  checkedIn?: number;
  pending?: number;
  vip?: number;
  activated?: number;
  invited?: number;
  notInvited?: number;
  activationRate?: number;
  ticketTypes?: Array<{ id: string; name: string }>;
};

type RouteContext = { params?: Record<string, string> };

type EventRecord = NonNullable<Awaited<ReturnType<typeof loadEvent>>>;
type BoothRecord = NonNullable<Awaited<ReturnType<typeof loadBooth>>>;

function normalizeRoles(
  role?: UserRole | UserRole[],
): UserRole[] | undefined {
  if (!role) return undefined;
  return Array.isArray(role) ? role : [role];
}

function resolveRequestAndId(
  requestOrId: Request | string,
  id?: string,
): { request?: Request; id: string } {
  if (typeof requestOrId === "string") {
    return { id: requestOrId };
  }
  if (!id) {
    throw new ApiError("缺少资源 ID", ErrorCode.VALIDATION_ERROR, 400);
  }
  return { request: requestOrId, id };
}

async function getSession(): Promise<AuthSession | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !session.user.role) return null;
  return session as AuthSession;
}

/**
 * 验证用户已登录，可选检查角色。
 *
 * @example
 * await requireAuth(request)
 * await requireAuth(request, UserRole.ORGANIZER)
 * await requireAuth([UserRole.PLATFORM_ADMIN]) // 兼容旧签名
 */
export async function requireAuth(
  request: Request,
  requiredRole?: UserRole | UserRole[],
): Promise<AuthResult>;
export async function requireAuth(
  requiredRoles?: UserRole | UserRole[],
): Promise<AuthResult>;
export async function requireAuth(
  requestOrRoles?: Request | UserRole | UserRole[],
  requiredRole?: UserRole | UserRole[],
): Promise<AuthResult> {
  const roles =
    requestOrRoles instanceof Request
      ? normalizeRoles(requiredRole)
      : normalizeRoles(requestOrRoles);

  return requireAuthSession(roles);
}

async function requireAuthSession(
  roles?: UserRole[],
): Promise<AuthResult> {
  const session = await getSession();
  if (!session) {
    throw new ApiError("未登录", ErrorCode.UNAUTHORIZED, 401);
  }

  if (roles && !hasAnyRole(session.user.role, roles)) {
    throw new ApiError("无权访问", ErrorCode.FORBIDDEN, 403);
  }

  return { session, user: session.user };
}

/**
 * 验证用户对活动的访问权限。
 *
 * - PLATFORM_ADMIN：直接通过
 * - ORGANIZER：event.organizerId === session.user.id
 * - EXPO_ORGANIZER：role assignment 或 entityId 关联该 event
 * - EXHIBITOR：在该活动下有展位
 */
export async function requireEventAccess(
  request: Request,
  eventId: string,
): Promise<{ session: AuthSession; event: EventRecord }>;
export async function requireEventAccess(
  eventId: string,
): Promise<{ session: AuthSession; event: EventRecord }>;
export async function requireEventAccess(
  requestOrEventId: Request | string,
  eventId?: string,
): Promise<{ session: AuthSession; event: EventRecord }> {
  const { id } = resolveRequestAndId(requestOrEventId, eventId);
  const { session } = await requireAuthSession();

  const loaded = await loadEvent(id);
  if (!loaded) {
    throw new ApiError("活动不存在", ErrorCode.NOT_FOUND, 404);
  }
  const event: EventRecord = loaded;

  if (session.user.role === UserRole.PLATFORM_ADMIN) {
    return { session, event };
  }

  if (session.user.role === UserRole.ORGANIZER) {
    if (event.organizerId !== session.user.id) {
      throw new ApiError("无权访问该活动", ErrorCode.FORBIDDEN, 403);
    }
    return { session, event };
  }

  if (session.user.role === UserRole.EXPO_ORGANIZER) {
    const allowed = await hasExpoOrganizerEventAccess(
      session.user.id,
      id,
      session.user.entityId,
    );
    if (!allowed) {
      throw new ApiError("无权访问该活动", ErrorCode.FORBIDDEN, 403);
    }
    return { session, event };
  }

  if (session.user.role === UserRole.EXHIBITOR) {
    const booth = await prisma.booth.findFirst({
      where: { eventId: id, exhibitorId: session.user.id },
      select: { id: true },
    });
    if (!booth) {
      throw new ApiError("无权访问该活动", ErrorCode.FORBIDDEN, 403);
    }
    return { session, event };
  }

  throw new ApiError("无权访问", ErrorCode.FORBIDDEN, 403);
}

/**
 * 验证用户对展位的访问权限。
 *
 * - PLATFORM_ADMIN：直接通过
 * - EXHIBITOR：booth.exhibitorId === session.user.id
 * - ORGANIZER / EXPO_ORGANIZER：可管理所属活动下的展位
 */
export async function requireBoothAccess(
  request: Request,
  boothId: string,
): Promise<{ session: AuthSession; booth: BoothRecord }>;
export async function requireBoothAccess(
  boothId: string,
): Promise<{ session: AuthSession; booth: BoothRecord }>;
export async function requireBoothAccess(
  requestOrBoothId: Request | string,
  boothId?: string,
): Promise<{ session: AuthSession; booth: BoothRecord }> {
  const { id } = resolveRequestAndId(requestOrBoothId, boothId);
  const { session } = await requireAuthSession();

  const loaded = await loadBooth(id);
  if (!loaded) {
    throw new ApiError("展位不存在", ErrorCode.NOT_FOUND, 404);
  }
  const booth: BoothRecord = loaded;

  if (session.user.role === UserRole.PLATFORM_ADMIN) {
    return { session, booth };
  }

  if (session.user.role === UserRole.EXHIBITOR) {
    if (booth.exhibitorId !== session.user.id) {
      throw new ApiError("无权访问该展位", ErrorCode.FORBIDDEN, 403);
    }
    return { session, booth };
  }

  if (session.user.role === UserRole.ORGANIZER) {
    if (booth.event.organizerId !== session.user.id) {
      throw new ApiError("无权访问该展位", ErrorCode.FORBIDDEN, 403);
    }
    return { session, booth };
  }

  if (session.user.role === UserRole.EXPO_ORGANIZER) {
    const allowed = await hasExpoOrganizerEventAccess(
      session.user.id,
      booth.eventId,
      session.user.entityId,
    );
    if (!allowed) {
      throw new ApiError("无权访问该展位", ErrorCode.FORBIDDEN, 403);
    }
    return { session, booth };
  }

  throw new ApiError("无权访问", ErrorCode.FORBIDDEN, 403);
}

/** 平台管理员快捷鉴权（含拥有平台管理员角色分配的用户） */
export async function requirePlatformAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !session.user.role) {
    throw new ApiError("未登录", ErrorCode.UNAUTHORIZED, 401);
  }

  const hasPlatformAdmin =
    session.user.hasPlatformAdmin ??
    session.user.role === UserRole.PLATFORM_ADMIN;

  if (session.user.role !== UserRole.PLATFORM_ADMIN && !hasPlatformAdmin) {
    throw new ApiError("无权访问", ErrorCode.FORBIDDEN, 403);
  }

  const authSession = session as AuthSession;
  return { session: authSession, user: authSession.user };
}

/** 标准成功响应：{ data, meta? } */
export function createSuccessResponse<T>(data: T, meta?: SuccessMeta) {
  return NextResponse.json(successResponse(data, meta));
}

/** 标准错误响应：{ error, code } */
export function createErrorResponse(
  message: string,
  code: ErrorCode,
  status = 400,
) {
  return NextResponse.json(errorResponse(message, code), { status });
}

type RouteHandler = (
  request: Request,
  context?: RouteContext,
) => Promise<Response>;

/**
 * 包裹 Route Handler，统一捕获 ApiError 与未预期异常。
 *
 * @example
 * export const GET = withErrorHandler(async (request, context) => {
 *   const eventId = context?.params?.eventId;
 *   const { event } = await requireEventAccess(request, eventId!);
 *   return createSuccessResponse(event);
 * });
 */
export function withErrorHandler(handler: RouteHandler) {
  return async (
    request: Request,
    context?: { params?: Promise<Record<string, string>> },
  ) => {
    try {
      const resolved: RouteContext | undefined = context?.params
        ? { params: await context.params }
        : undefined;
      return await handler(request, resolved);
    } catch (error) {
      if (error instanceof ApiError) {
        return createErrorResponse(error.message, error.code, error.status);
      }
      console.error(error);
      return createErrorResponse(
        "服务器内部错误",
        ErrorCode.INTERNAL_ERROR,
        500,
      );
    }
  };
}

export function isDbRole(role: UserRole): role is DbUserRole {
  return Object.values(DbUserRole).includes(role as DbUserRole);
}

async function loadEvent(eventId: string) {
  return prisma.event.findUnique({ where: { id: eventId } });
}

async function loadBooth(boothId: string) {
  return prisma.booth.findUnique({
    where: { id: boothId },
    include: { event: { select: { id: true, organizerId: true } } },
  });
}

async function hasExpoOrganizerEventAccess(
  userId: string,
  eventId: string,
  entityId: string | null,
) {
  if (entityId === eventId) return true;

  const assignment = await prisma.userRoleAssignment.findFirst({
    where: {
      userId,
      role: DbUserRole.EXPO_ORGANIZER,
      entityId: eventId,
    },
    select: { id: true },
  });
  if (assignment) return true;

  // 当前 session 绑定展位时，通过 Booth.event_id 反查活动权限
  if (entityId) {
    const booth = await prisma.booth.findFirst({
      where: { id: entityId, eventId },
      select: { id: true },
    });
    if (booth) return true;
  }

  return false;
}

export type AppSession = AuthSession;
