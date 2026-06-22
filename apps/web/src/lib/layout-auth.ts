import { authOptions, hasAnyRole } from "@/lib/auth";
import type { UserRole } from "@connectiq/types";
import { getServerSession } from "next-auth";
import type { Session } from "next-auth";
import { redirect } from "next/navigation";

const PLATFORM_ADMIN = "PLATFORM_ADMIN" as UserRole;

export async function requireLayoutSession(
  allowedRoles: UserRole[],
): Promise<Session> {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const rolesWithAdmin = [...allowedRoles, PLATFORM_ADMIN];
  if (!hasAnyRole(session.user.role, rolesWithAdmin)) {
    redirect("/403");
  }

  return session;
}

/** 账号管理员共用页面（活动列表 / 用户池 / 组织主页）— 不限 legacy role */
export async function requireAccountAdminLayoutSession(): Promise<Session> {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  if (
    session.user.userType === "PLATFORM_ADMIN" ||
    session.user.userType === "ACCOUNT_ADMIN"
  ) {
    return session;
  }

  redirect("/403");
}
