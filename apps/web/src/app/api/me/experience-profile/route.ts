import { ExperienceAccountStatus } from "@connectiq/database";
import { UserRole } from "@connectiq/types";
import {
  createSuccessResponse,
  requireAuth,
  withErrorHandler,
} from "@/lib/api-auth";
import { getActiveExperienceAccount } from "@/lib/experience/experience-account-service";

/** 当前登录用户是否为进行中的体验账号（供前端禁用批量邀请入口） */
export const GET = withErrorHandler(async () => {
  const { user } = await requireAuth([
    UserRole.ORGANIZER,
    UserRole.EXPO_ORGANIZER,
    UserRole.PLATFORM_ADMIN,
  ]);

  const record = await getActiveExperienceAccount(user.id);

  return createSuccessResponse({
    isActiveExperience: record?.status === ExperienceAccountStatus.ACTIVE,
  });
});
