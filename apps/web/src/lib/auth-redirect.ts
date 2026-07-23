import type { Session } from "next-auth";
import { withPublicPath } from "@/lib/public-path";

const ROLE_COOKIE_USER_TYPE = "next-auth.user-type";
const ROLE_COOKIE_ADMIN_STATUS = "next-auth.admin-status";

export { ROLE_COOKIE_USER_TYPE, ROLE_COOKIE_ADMIN_STATUS };

export function getAccountAdminHomePath(
  _accountType?: string | null,
  _orgId?: string | null,
): string {
  return "/organizer/dashboard";
}

/** 账号管理员不可用时的落地页（未审核 / 驳回 / 挂起） */
export function getAccountAdminBlockedPath(
  adminStatus: string | null | undefined,
): string {
  switch (adminStatus) {
    case "REJECTED":
      return "/register/rejected";
    case "SUSPENDED":
      return "/account-suspended";
    case "PENDING_REVIEW":
    default:
      // 无组织、status 为空：视为待审（正式申请尚未通过）
      return "/register/pending";
  }
}

function resolveActiveAdminStatus(user: Session["user"]): string | null {
  if (user.activeAdminStatus) return user.activeAdminStatus;
  const usableOrg = user.ownedOrgs?.find(
    (org) => org.admin_status === "APPROVED" || org.admin_status === "TRIAL",
  );
  return usableOrg?.admin_status ?? null;
}

export function getPostLoginRedirectPath(user: Session["user"]): string {
  switch (user.userType) {
    case "PLATFORM_ADMIN":
      return "/platform/overview";

    case "ACCOUNT_ADMIN":
      switch (resolveActiveAdminStatus(user)) {
        case "TRIAL":
          return "/organizer/dashboard";
        case "APPROVED":
          return getAccountAdminHomePath(
            user.activeOrgType,
            user.activeOrgId,
          );
        case "PENDING_REVIEW":
        case "REJECTED":
        case "SUSPENDED":
          return getAccountAdminBlockedPath(resolveActiveAdminStatus(user));
        default:
          return getAccountAdminBlockedPath(null);
      }

    case "END_USER":
    default:
      return "/403";
  }
}

export function setAuthRoleCookies(user: Session["user"]) {
  const maxAge = 60 * 60 * 24 * 30;
  const base = `path=/; max-age=${maxAge}; SameSite=Lax`;
  document.cookie = `${ROLE_COOKIE_USER_TYPE}=${encodeURIComponent(user.userType)}; ${base}`;
  document.cookie = `${ROLE_COOKIE_ADMIN_STATUS}=${encodeURIComponent(user.activeAdminStatus ?? "")}; ${base}`;
}

export function clearAuthRoleCookies() {
  const expired = "path=/; max-age=0; SameSite=Lax";
  document.cookie = `${ROLE_COOKIE_USER_TYPE}=; ${expired}`;
  document.cookie = `${ROLE_COOKIE_ADMIN_STATUS}=; ${expired}`;
}

export async function signOutWithCleanup(callbackUrl = "/login") {
  clearAuthRoleCookies();
  const { signOut } = await import("next-auth/react");
  const path = callbackUrl.startsWith("/")
    ? withPublicPath(callbackUrl)
    : withPublicPath(`/${callbackUrl}`);
  const target =
    typeof window !== "undefined" && !callbackUrl.startsWith("http")
      ? `${window.location.origin}${path}`
      : callbackUrl;
  return signOut({ callbackUrl: target });
}
