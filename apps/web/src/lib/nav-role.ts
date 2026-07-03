import { UserRole } from "@connectiq/types";

/** 根据活动类型解析侧栏菜单角色（账号管理员统一入口，按活动形态切换） */
export function resolveEventNavRole(params: {
  activityType?: string | null;
  eventType?: string | null;
  isExhibitorRoute?: boolean;
  userType?: string | null;
}): UserRole {
  const { activityType, eventType, isExhibitorRoute, userType } = params;

  if (isExhibitorRoute) {
    return UserRole.EXHIBITOR;
  }

  // 账号管理员在 /events/ 下统一走主办方导航（含 EXHIBITION 参展活动）
  if (userType === "ACCOUNT_ADMIN" || userType === "PLATFORM_ADMIN") {
    return UserRole.ORGANIZER;
  }

  if (activityType === "EXHIBITION") {
    return UserRole.EXHIBITOR;
  }

  if (activityType === "EXPO" || eventType === "EXPO") {
    return UserRole.EXPO_ORGANIZER;
  }
  return UserRole.ORGANIZER;
}

/** 账号管理员平台级侧栏统一使用主办方导航 */
export function resolvePlatformNavRole(
  userType: string | undefined,
  legacyRole: UserRole,
): UserRole {
  if (userType === "PLATFORM_ADMIN" || legacyRole === UserRole.PLATFORM_ADMIN) {
    return UserRole.PLATFORM_ADMIN;
  }
  return UserRole.ORGANIZER;
}
