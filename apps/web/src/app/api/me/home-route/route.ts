import { AccountType } from "@connectiq/database";
import {
  createSuccessResponse,
  requireAuth,
  withErrorHandler,
} from "@/lib/api-auth";
import { getPostLoginRedirectPath } from "@/lib/auth-redirect";
import { isOrgAdminUsable } from "@/lib/org-access";
import { resolveOrgHomeRoute } from "@/lib/org-home-route";
import { getActiveExperienceAccount } from "@/lib/experience/experience-account-service";

export const GET = withErrorHandler(async () => {
  const { session } = await requireAuth();
  const user = session.user;

  if (user.userType === "PLATFORM_ADMIN") {
    return createSuccessResponse({ path: "/platform/overview" });
  }

  if (user.userType === "ACCOUNT_ADMIN") {
    // 已有正式/试用可用组织时，不因历史体验账号过期跳过期页
    if (!isOrgAdminUsable(user.activeAdminStatus)) {
      const experience = await getActiveExperienceAccount(user.id);
      if (experience?.status === "EXPIRED") {
        return createSuccessResponse({ path: "/experience/expired" });
      }
      return createSuccessResponse({ path: getPostLoginRedirectPath(user) });
    }
    if (user.activeAdminStatus === "TRIAL") {
      return createSuccessResponse({ path: "/organizer/dashboard" });
    }
    if (user.activeOrgId && user.activeOrgType) {
      const path = await resolveOrgHomeRoute(
        user.activeOrgId,
        user.activeOrgType as AccountType,
      );
      return createSuccessResponse({ path });
    }
    return createSuccessResponse({ path: "/organizer/dashboard" });
  }

  return createSuccessResponse({ path: getPostLoginRedirectPath(user) });
});
