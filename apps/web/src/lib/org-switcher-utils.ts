/** 组织类型图标、标签与侧边栏主题（身份切换器共用） */

export type OwnedOrgSummary = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  account_type: string;
  admin_status: string;
};

export function getOrgTypeIcon(type: string) {
  const icons: Record<string, string> = {
    ORGANIZATION: "🏢",
    CONFERENCE_ORGANIZER: "🎤",
    EXPO_ORGANIZER: "🏛️",
    EXHIBITOR: "🏪",
  };
  return icons[type] || "🏢";
}

export function getOrgTypeShortName(type: string) {
  const names: Record<string, string> = {
    ORGANIZATION: "组织",
    CONFERENCE_ORGANIZER: "主办方",
    EXPO_ORGANIZER: "展览方",
    EXHIBITOR: "参展商",
  };
  return names[type] || "组织";
}

export function getOrgTypeFullName(type: string) {
  const names: Record<string, string> = {
    ORGANIZATION: "组织",
    CONFERENCE_ORGANIZER: "会议主办方",
    EXPO_ORGANIZER: "展览主办方",
    EXHIBITOR: "参展商",
  };
  return names[type] || type;
}

export function getOrgTypeBadgeStyle(type: string) {
  const styles: Record<string, string> = {
    ORGANIZATION: "bg-brand-blue-light text-brand-blue",
    CONFERENCE_ORGANIZER: "bg-brand-blue-light text-brand-blue",
    EXPO_ORGANIZER: "bg-brand-green-light text-brand-green",
    EXHIBITOR: "bg-brand-amber-light text-brand-amber",
  };
  return styles[type] || "bg-content text-text-muted";
}

export function getOrgSidebarActiveClass(
  activeOrgType?: string | null,
  userType?: string | null,
): string {
  if (userType === "PLATFORM_ADMIN") return "active-purple";
  const map: Record<string, string> = {
    ORGANIZATION: "active-blue",
    CONFERENCE_ORGANIZER: "active-blue",
    EXPO_ORGANIZER: "active-green",
    EXHIBITOR: "active-amber",
  };
  return map[activeOrgType ?? ""] ?? "active-blue";
}

export function getOrgLogoGradient(activeOrgType?: string | null): string {
  const map: Record<string, string> = {
    ORGANIZATION: "from-brand-blue to-brand-purple",
    CONFERENCE_ORGANIZER: "from-brand-blue to-brand-purple",
    EXPO_ORGANIZER: "from-brand-green to-brand-blue",
    EXHIBITOR: "from-brand-amber to-brand-gold",
  };
  return map[activeOrgType ?? ""] ?? "from-brand-blue to-brand-purple";
}

export function resolveCurrentOrgFromSession(
  ownedOrgs: OwnedOrgSummary[],
  activeOrgId?: string | null,
) {
  return (
    ownedOrgs.find((o) => o.id === activeOrgId) ??
    ownedOrgs.find((o) => o.admin_status === "APPROVED") ??
    ownedOrgs[0] ??
    null
  );
}
