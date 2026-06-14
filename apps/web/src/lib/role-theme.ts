import { UserRole } from "@connectiq/types";

export type RoleTheme = {
  accent: "blue" | "green" | "amber" | "purple";
  activeClass: string;
  logoGradient: string;
  switcherHighlight: string;
};

const ORGANIZER_THEME: RoleTheme = {
  accent: "blue",
  activeClass: "active-blue",
  logoGradient: "from-brand-blue to-brand-purple",
  switcherHighlight: "bg-brand-blue-light/50",
};

const EXPO_THEME: RoleTheme = {
  accent: "green",
  activeClass: "active-green",
  logoGradient: "from-brand-green to-brand-blue",
  switcherHighlight: "bg-brand-green-light/50",
};

const EXHIBITOR_THEME: RoleTheme = {
  accent: "green",
  activeClass: "active-green",
  logoGradient: "from-brand-green to-brand-blue",
  switcherHighlight: "bg-brand-green-light/50",
};

const PLATFORM_THEME: RoleTheme = {
  accent: "purple",
  activeClass: "active-purple",
  logoGradient: "from-brand-purple to-brand-blue",
  switcherHighlight: "bg-brand-purple-light/50",
};

export function getRoleTheme(role: UserRole): RoleTheme {
  switch (role) {
    case UserRole.EXPO_ORGANIZER:
      return EXPO_THEME;
    case UserRole.EXHIBITOR:
      return EXHIBITOR_THEME;
    case UserRole.PLATFORM_ADMIN:
      return PLATFORM_THEME;
    case UserRole.ORGANIZER:
    default:
      return ORGANIZER_THEME;
  }
}
