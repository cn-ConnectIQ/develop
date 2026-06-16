import type { Session } from "next-auth";

const ROLE_COOKIE_USER_TYPE = "next-auth.user-type";
const ROLE_COOKIE_ADMIN_STATUS = "next-auth.admin-status";

export { ROLE_COOKIE_USER_TYPE, ROLE_COOKIE_ADMIN_STATUS };

export function getAccountAdminHomePath(
  accountType: string | null | undefined,
  _orgId?: string | null,
): string {
  switch (accountType) {
    case "EXPO_ORGANIZER":
    case "EXHIBITOR":
    case "CONFERENCE_ORGANIZER":
    default:
      return "/events";
  }
}

function resolveApprovedAdminStatus(user: Session["user"]): string | null {
  if (user.activeAdminStatus) return user.activeAdminStatus;
  const approvedOrg = user.ownedOrgs?.find(
    (org) => org.admin_status === "APPROVED",
  );
  return approvedOrg?.admin_status ?? null;
}

export function getPostLoginRedirectPath(user: Session["user"]): string {
  switch (user.userType) {
    case "PLATFORM_ADMIN":
      return "/platform/overview";

    case "ACCOUNT_ADMIN":
      switch (resolveApprovedAdminStatus(user)) {
        case "APPROVED":
          return getAccountAdminHomePath(
            user.activeOrgType,
            user.activeOrgId,
          );
        case "PENDING_REVIEW":
          return "/register/pending";
        case "REJECTED":
          return "/register/rejected";
        case "SUSPENDED":
          return "/account-suspended";
        default:
          return "/register/pending";
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
  return signOut({ callbackUrl });
}
