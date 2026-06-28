import { prisma } from "@connectiq/database";
import { ErrorCode, UserRole } from "@connectiq/types";
import { isOrgAdminUsable } from "@/lib/org-access";
import { errorResponse, successResponse } from "@connectiq/utils";
import { getServerSession } from "next-auth/next";
import type { Session } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "./auth";

export type UserType = Session["user"]["userType"];
export type AuthSession = Session;

// ── 标准响应 ──

export function unauthorized() {
  return NextResponse.json(
    { error: "请先登录", code: "UNAUTHORIZED" },
    { status: 401 },
  );
}

export function forbidden(msg = "没有权限执行此操作") {
  return NextResponse.json({ error: msg, code: "FORBIDDEN" }, { status: 403 });
}

export function badRequest(msg: string) {
  return NextResponse.json({ error: msg, code: "BAD_REQUEST" }, { status: 400 });
}

export function success<T>(data: T, meta?: Record<string, unknown>) {
  return NextResponse.json({ data, ...(meta ? { meta } : {}) });
}

// ?? ????????? ??

export async function getSession() {
  return getServerSession(authOptions);
}

// ?? ??????????? API??? null ????????

export async function requireAuthSession(
  _request?: NextRequest,
): Promise<Session | null> {
  void _request;
  const session = await getSession();
  if (!session?.user?.id) return null;
  return session;
}

// ?? ????????? ??

export async function requirePlatformAdminAccess(
  _request?: NextRequest,
): Promise<{ session: Session } | { error: NextResponse }> {
  void _request;
  const session = await requireAuthSession();
  if (!session) return { error: unauthorized() };
  if (session.user.userType !== "PLATFORM_ADMIN") {
    return { error: forbidden("仅平台管理员可访问") };
  }
  return { session };
}

// ?? ??????????????????

export async function requireAccountAdmin(
  _request?: NextRequest,
): Promise<
  { session: Session; orgId: string } | { error: NextResponse }
> {
  void _request;
  const session = await requireAuthSession();
  if (!session) return { error: unauthorized() };
  if (session.user.userType !== "ACCOUNT_ADMIN") {
    return { error: forbidden("仅账号管理员可访问") };
  }
  if (!isOrgAdminUsable(session.user.activeAdminStatus)) {
    return {
      error: NextResponse.json(
        {
          error:
            session.user.activeAdminStatus === "PENDING_REVIEW"
              ? "账号尚未审核通过"
              : "账号暂不可用",
          code:
            session.user.activeAdminStatus === "PENDING_REVIEW"
              ? "ADMIN_NOT_APPROVED"
              : "ADMIN_NOT_USABLE",
          adminStatus: session.user.activeAdminStatus,
          hint:
            session.user.activeAdminStatus === "PENDING_REVIEW"
              ? (session.user.ownedOrgs || []).some(
                  (o) => o.admin_status === "APPROVED" || o.admin_status === "TRIAL",
                )
                ? "您已有其他可用组织，请切换到该组织"
                : "可先通过免费试用体验，或等待正式审核"
              : null,
        },
        { status: 403 },
      ),
    };
  }
  if (!session.user.activeOrgId) {
    return { error: forbidden("账号未关联组织") };
  }
  return { session, orgId: session.user.activeOrgId };
}

// ?? ???????????????????????????

type EventRecord = NonNullable<Awaited<ReturnType<typeof loadEvent>>>;
type BoothRecord = NonNullable<Awaited<ReturnType<typeof loadBooth>>>;

export async function requireEventAccessCheck(
  requestOrEventId: NextRequest | string,
  eventId?: string,
): Promise<
  | { session: Session; event: EventRecord; orgId: string | null }
  | { error: NextResponse }
> {
  const id =
    typeof requestOrEventId === "string" ? requestOrEventId : eventId!;
  void (typeof requestOrEventId === "string" ? undefined : requestOrEventId);

  const session = await requireAuthSession();
  if (!session) return { error: unauthorized() };

  if (session.user.userType === "PLATFORM_ADMIN") {
    const event = await loadEvent(id);
    if (!event) return { error: forbidden("活动不存在") };
    return { session, event, orgId: null };
  }

  const adminResult = await requireAccountAdmin();
  if ("error" in adminResult) return adminResult;

  const { orgId } = adminResult;
  const event = await prisma.event.findFirst({
    where: { id, orgId },
  });
  if (!event) return { error: forbidden("你没有权限访问此活动") };
  return { session, event, orgId };
}

// ?? ????????? ??

export async function requireBoothAccessCheck(
  requestOrBoothId: NextRequest | string,
  boothId?: string,
): Promise<
  | { session: Session; booth: BoothRecord; orgId: string }
  | { error: NextResponse }
> {
  const id =
    typeof requestOrBoothId === "string" ? requestOrBoothId : boothId!;
  void (typeof requestOrBoothId === "string" ? undefined : requestOrBoothId);

  const session = await requireAuthSession();
  if (!session) return { error: unauthorized() };

  if (session.user.userType === "PLATFORM_ADMIN") {
    const booth = await loadBooth(id);
    if (!booth) return { error: forbidden("展位不存在") };
    return {
      session,
      booth,
      orgId: booth.companyOrgId ?? booth.event.orgId ?? "",
    };
  }

  const adminResult = await requireAccountAdmin();
  if ("error" in adminResult) return adminResult;

  const { session: adminSession, orgId } = adminResult;

  const booth = await prisma.exhibitorBooth.findFirst({
    where: {
      id,
      OR: [
        { companyOrgId: orgId },
        { event: { orgId } },
        { operatorUserId: adminSession.user.id },
      ],
    },
    include: {
      event: { select: { id: true, orgId: true, organizerId: true } },
    },
  });
  if (!booth) return { error: forbidden("你没有权限访问此展位") };
  return { session: adminSession, booth, orgId };
}

// ?? ??????????? ??

type RouteContext = { params?: Record<string, string> };

type RouteHandler = (
  req: NextRequest,
  ctx?: RouteContext,
) => Promise<NextResponse | Response>;

export function withErrorHandler(handler: RouteHandler) {
  return async (
    req: NextRequest,
    ctx?: { params?: Promise<Record<string, string>> },
  ) => {
    try {
      const resolvedCtx: RouteContext | undefined = ctx?.params
        ? { params: await ctx.params }
        : undefined;
      return await handler(req, resolvedCtx);
    } catch (err) {
      if (err instanceof ApiError) {
        return createErrorResponse(err.message, err.code, err.status);
      }
      console.error("[API Error]", err);
      return NextResponse.json(
        { error: "服务器内部错误", code: "INTERNAL_ERROR" },
        { status: 500 },
      );
    }
  };
}

async function loadEvent(eventId: string) {
  return prisma.event.findUnique({ where: { id: eventId } });
}

async function loadBooth(boothId: string) {
  return prisma.exhibitorBooth.findUnique({
    where: { id: boothId },
    include: {
      event: { select: { id: true, orgId: true, organizerId: true } },
    },
  });
}

function responseToApiError(response: NextResponse, fallback: string): ApiError {
  const status = response.status;
  if (status === 401) {
    return new ApiError("未登录", ErrorCode.UNAUTHORIZED, 401);
  }
  if (status === 404) {
    return new ApiError(fallback, ErrorCode.NOT_FOUND, 404);
  }
  return new ApiError(fallback, ErrorCode.FORBIDDEN, 403);
}

// ??????????????????????????????????????????????????????????????
// ??????? API ????? throw ??????????
// ??????????????????????????????????????????????????????????????

export class ApiError extends Error {
  constructor(
    message: string,
    public code: ErrorCode,
    public status: number,
  ) {
    super(message);
  }
}

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
  checkedIn?: number;
  pending?: number;
  vip?: number;
  activated?: number;
  invited?: number;
  notInvited?: number;
  activationRate?: number;
  pageSize?: number;
  totalPages?: number;
  ticketTypes?: Array<{ id: string; name: string }>;
};

export type AppSession = AuthSession;

function deriveLegacyRole(user: Session["user"]): UserRole {
  if (user.userType === "PLATFORM_ADMIN") return UserRole.PLATFORM_ADMIN;
  if (user.userType === "ACCOUNT_ADMIN") {
    switch (user.activeOrgType) {
      case "EXPO_ORGANIZER":
        return UserRole.EXPO_ORGANIZER;
      case "EXHIBITOR":
        return UserRole.EXHIBITOR;
      default:
        return UserRole.ORGANIZER;
    }
  }
  throw new ApiError("无权访问", ErrorCode.FORBIDDEN, 403);
}

function normalizeRoles(
  role?: UserRole | UserRole[],
): UserRole[] | undefined {
  if (!role) return undefined;
  return Array.isArray(role) ? role : [role];
}

function hasAnyRole(role: UserRole, allowedRoles: UserRole[]): boolean {
  return allowedRoles.includes(role);
}

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

  const session = await requireAuthSession();
  if (!session) {
    throw new ApiError("未登录", ErrorCode.UNAUTHORIZED, 401);
  }

  if (roles) {
    const legacyRole = deriveLegacyRole(session.user);
    if (!hasAnyRole(legacyRole, roles)) {
      throw new ApiError("无权访问", ErrorCode.FORBIDDEN, 403);
    }
  }

  return { session, user: session.user };
}

export async function requirePlatformAdmin(): Promise<AuthResult> {
  const result = await requirePlatformAdminAccess();
  if ("error" in result) {
    throw responseToApiError(result.error, "无权访问");
  }
  return { session: result.session, user: result.session.user };
}

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
  const id =
    typeof requestOrEventId === "string" ? requestOrEventId : eventId!;
  if (!id) {
    throw new ApiError("缺少活动 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  const result = await requireEventAccessCheck(id);
  if ("error" in result) {
    throw responseToApiError(result.error, "无权访问该活动");
  }

  return { session: result.session, event: result.event };
}

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
  const id =
    typeof requestOrBoothId === "string" ? requestOrBoothId : boothId!;
  if (!id) {
    throw new ApiError("缺少展位 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  const result = await requireBoothAccessCheck(id);
  if ("error" in result) {
    throw responseToApiError(result.error, "无权访问该展位");
  }

  return { session: result.session, booth: result.booth };
}

export function createSuccessResponse<T>(data: T, meta?: SuccessMeta) {
  return NextResponse.json(successResponse(data, meta));
}

export function createErrorResponse(
  message: string,
  code: ErrorCode,
  status = 400,
) {
  return NextResponse.json(errorResponse(message, code), { status });
}

// ? API ?????????????
export {
  requireAuthSession as requireAuthNullable,
  requirePlatformAdminAccess as requirePlatformAdminCheck,
  requireEventAccessCheck as requireEventAccessNew,
  requireBoothAccessCheck as requireBoothAccessNew,
};
