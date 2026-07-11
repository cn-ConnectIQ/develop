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
    const experience = await getActiveExperienceAccount(user.id);
    if (experience?.status === "ACTIVE") {
      return createSuccessResponse({ path: `/events/${experience.eventId}` });
    }
    if (experience?.status === "EXPIRED") {
      return createSuccessResponse({ path: "/experience/expired" });
    }

    if (!isOrgAdminUsable(user.activeAdminStatus)) {
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
    return createSuccessResponse({ path: "/events" });
  }

  return createSuccessResponse({ path: getPostLoginRedirectPath(user) });
});
