import {
  ApiError,
  createErrorResponse,
  createSuccessResponse,
  requireAuth,
  withErrorHandler,
} from "@/lib/api-auth";
import { getTrialProfileForOrg } from "@/lib/organizer-trial-service";
import { isTrialOrg } from "@/lib/org-access";
import { ErrorCode, UserRole } from "@connectiq/types";

export const GET = withErrorHandler(async () => {
  const { session } = await requireAuth([
    UserRole.ORGANIZER,
    UserRole.EXPO_ORGANIZER,
    UserRole.PLATFORM_ADMIN,
  ]);

  const orgId = session.user.activeOrgId;
  if (!orgId) {
    throw new ApiError("未关联组织", ErrorCode.VALIDATION_ERROR, 400);
  }

  const profile = await getTrialProfileForOrg(orgId);
  if (!profile) {
    return createErrorResponse(
      "当前组织无试用档案",
      ErrorCode.NOT_FOUND,
      404,
    );
  }

  return createSuccessResponse({
    ...profile,
    isTrial: isTrialOrg(profile.adminStatus),
  });
});
