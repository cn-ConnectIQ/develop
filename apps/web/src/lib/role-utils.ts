import { UserRole } from "@connectiq/types";

export type RoleMeta = {
  role: UserRole;
  emoji: string;
  label: string;
  colorClass: string;
};

export const ROLE_META: Record<UserRole, RoleMeta> = {
  [UserRole.PLATFORM_ADMIN]: {
    role: UserRole.PLATFORM_ADMIN,
    emoji: "⚙️",
    label: "平台管理员",
    colorClass: "text-brand-purple",
  },
  [UserRole.ORGANIZER]: {
    role: UserRole.ORGANIZER,
    emoji: "🎤",
    label: "主办方",
    colorClass: "text-brand-blue",
  },
  [UserRole.EXPO_ORGANIZER]: {
    role: UserRole.EXPO_ORGANIZER,
    emoji: "🏛️",
    label: "展览主办方",
    colorClass: "text-brand-green",
  },
  [UserRole.EXHIBITOR]: {
    role: UserRole.EXHIBITOR,
    emoji: "🏪",
    label: "参展商",
    colorClass: "text-brand-green",
  },
};

export function getRoleHomePath(
  role: UserRole,
  entityId: string | null,
): string {
  switch (role) {
    case UserRole.PLATFORM_ADMIN:
      return "/platform/overview";
    case UserRole.ORGANIZER:
      return entityId ? `/events/${entityId}` : "/events";
    case UserRole.EXPO_ORGANIZER:
      return entityId ? `/events/${entityId}` : "/events";
    case UserRole.EXHIBITOR:
      return "/exhibitor/dashboard";
    default:
      return "/events";
  }
}

/** 管理端默认首页：有平台管理员权限时统一进入平台概览 */
export function getAdminHomePath(
  role: UserRole,
  entityId: string | null,
  hasPlatformAdmin = false,
): string {
  if (hasPlatformAdmin) return "/platform/overview";
  return getRoleHomePath(role, entityId);
}
