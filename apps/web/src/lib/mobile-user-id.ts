import {
  UserType as PrismaUserType,
  prisma,
} from "@connectiq/database";
import { ErrorCode } from "@connectiq/types";
import { ApiError, requireAccountAdmin, requireAuth } from "@/lib/api-auth";
import { isOrgAdminUsable } from "@/lib/org-access";

export type MobileAuthResult = { userId: string };

export type MobileAccountAdminResult = { userId: string; orgId: string };

/** 解析小程序 Bearer：dev-mock-token / mini_{userId}_* */
export async function resolveMiniBearerUserId(token: string): Promise<string | null> {
  if (token === "dev-mock-token") {
    const demo = await prisma.user.findFirst({
      where: { phone: "13800138000" },
      select: { id: true },
    });
    if (demo) return demo.id;
    const anyUser = await prisma.user.findFirst({ select: { id: true } });
    return anyUser?.id ?? null;
  }

  const prefix = "mini_";
  if (token.startsWith(prefix)) {
    const rest = token.slice(prefix.length);
    const userId = rest.split("_")[0];
    if (userId) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true },
      });
      return user?.id ?? null;
    }
  }

  return null;
}

/** 可选鉴权：无 token 时返回 null，不抛 401 */
export async function resolveOptionalMobileUserId(
  request: Request,
): Promise<string | null> {
  try {
    const { user } = await requireAuth(request);
    return user.id;
  } catch (err) {
    if (!(err instanceof ApiError) || err.status !== 401) throw err;
  }

  const auth = request.headers.get("authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return null;

  return resolveMiniBearerUserId(token);
}

/** 小程序 / 移动端 Bearer 鉴权（含 dev-mock-token、mini_ token） */
export async function resolveMobileUserId(request: Request): Promise<string> {
  try {
    const { user } = await requireAuth(request);
    return user.id;
  } catch (err) {
    if (!(err instanceof ApiError) || err.status !== 401) throw err;
  }

  const auth = request.headers.get("authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) {
    throw new ApiError("未登录", ErrorCode.UNAUTHORIZED, 401);
  }

  const userId = await resolveMiniBearerUserId(token);
  if (userId) return userId;

  throw new ApiError("未登录", ErrorCode.UNAUTHORIZED, 401);
}

/** 小程序 / 移动端鉴权（session 或 mini_ token） */
export async function requireMobileAuth(request: Request): Promise<MobileAuthResult> {
  const userId = await resolveMobileUserId(request);
  return { userId };
}

/** 移动端账号管理员鉴权（session 或 mini_ token + ACCOUNT_ADMIN） */
export async function requireMobileAccountAdmin(
  request: Request,
): Promise<MobileAccountAdminResult> {
  const sessionResult = await requireAccountAdmin();
  if (!("error" in sessionResult)) {
    return {
      userId: sessionResult.session.user.id,
      orgId: sessionResult.orgId,
    };
  }

  const userId = await resolveMobileUserId(request);
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      userType: true,
      org: { select: { id: true, adminStatus: true } },
      ownedOrg: { select: { id: true, adminStatus: true } },
    },
  });

  if (!user || user.userType !== PrismaUserType.ACCOUNT_ADMIN) {
    throw new ApiError("仅账号管理员可访问", ErrorCode.FORBIDDEN, 403);
  }

  const org = user.org ?? user.ownedOrg;
  if (!org) {
    throw new ApiError("账号未关联组织", ErrorCode.FORBIDDEN, 403);
  }
  if (!isOrgAdminUsable(org.adminStatus)) {
    throw new ApiError("账号尚未可用", ErrorCode.FORBIDDEN, 403);
  }

  return { userId, orgId: org.id };
}
