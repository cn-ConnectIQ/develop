import { AccountType } from "@connectiq/database";
import {
  createSuccessResponse,
  requireAuth,
  withErrorHandler,
} from "@/lib/api-auth";
import { getPostLoginRedirectPath } from "@/lib/auth-redirect";
import { resolveOrgHomeRoute } from "@/lib/org-home-route";

export const GET = withErrorHandler(async () => {
  const { session } = await requireAuth();
  const user = session.user;

  if (user.userType === "PLATFORM_ADMIN") {
    return createSuccessResponse({ path: "/platform/overview" });
  }

  if (user.userType === "ACCOUNT_ADMIN") {
    if (user.activeAdminStatus !== "APPROVED") {
      return createSuccessResponse({ path: getPostLoginRedirectPath(user) });
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
