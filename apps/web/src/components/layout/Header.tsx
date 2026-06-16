"use client";

import { Bell, ChevronDown, LogOut, Settings, Shield, UserRound } from "lucide-react";
import { signOutWithCleanup } from "@/lib/auth-redirect";
import { useSession } from "next-auth/react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import type { AdminUser } from "@/components/admin/admin-sidebar";
import { BreadcrumbNav } from "@/components/layout/BreadcrumbNav";
import { OrgSwitcher } from "@/components/layout/OrgSwitcher";
import { useOrgSwitcher } from "@/hooks/useOrgSwitcher";
import {
  getOrgTypeBadgeStyle,
  resolveCurrentOrgFromSession,
} from "@/lib/org-switcher-utils";
import { getRoleLabel } from "@/config/navigation";
import { getRoleTheme } from "@/lib/role-theme";
import { cn } from "@/lib/utils";
import type { UserRole } from "@connectiq/types";

type HeaderProps = {
  user: AdminUser;
  title?: string;
  actions?: React.ReactNode;
  notificationCount?: number;
};

export function Header({
  user,
  title,
  actions,
  notificationCount = 3,
}: HeaderProps) {
  const { data: session } = useSession();
  const { switchOrg, switching } = useOrgSwitcher();
  const role = user.role as UserRole;
  const theme = getRoleTheme(role);

  const ownedOrgs = session?.user?.ownedOrgs ?? [];
  const currentOrg = resolveCurrentOrgFromSession(
    ownedOrgs,
    session?.user?.activeOrgId,
  );

  const avatarAccent =
    session?.user?.userType === "ACCOUNT_ADMIN" && session.user.activeOrgType
      ? session.user.activeOrgType
      : null;

  const avatarBgClass = avatarAccent
    ? getOrgTypeBadgeStyle(avatarAccent)
    : theme.accent === "green"
      ? "bg-brand-green-light text-brand-green"
      : theme.accent === "amber"
        ? "bg-brand-amber-light text-brand-amber"
        : theme.accent === "purple"
          ? "bg-brand-purple-light text-brand-purple"
          : "bg-brand-blue-light text-brand-blue";

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border-light bg-white px-4">
      {session?.user?.userType === "ACCOUNT_ADMIN" && currentOrg && (
        <OrgSwitcher
          currentOrgId={session.user.activeOrgId ?? currentOrg.id}
          currentOrgName={currentOrg.name}
          currentOrgType={session.user.activeOrgType ?? currentOrg.account_type}
          currentLogoUrl={currentOrg.logo_url}
          ownedOrgs={ownedOrgs}
          onSwitch={switchOrg}
          switching={switching}
        />
      )}

      {session?.user?.userType === "PLATFORM_ADMIN" && (
        <div className="flex items-center gap-2 rounded-lg bg-brand-gold/20 px-3 py-1.5">
          <Shield className="size-4 text-brand-gold" />
          <span className="text-sm font-medium text-brand-gold">平台管理员</span>
        </div>
      )}

      {(session?.user?.userType === "ACCOUNT_ADMIN" ||
        session?.user?.userType === "PLATFORM_ADMIN") && (
        <Separator orientation="vertical" className="hidden h-6 md:block" />
      )}

      <BreadcrumbNav />

      {title && (
        <h1 className="truncate text-[15px] font-semibold text-[var(--admin-ink)] lg:hidden">
          {title}
        </h1>
      )}

      <div className="flex-1" />

      {actions}

      <button
        type="button"
        className="relative flex size-8 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-content hover:text-[var(--admin-ink)]"
        aria-label="通知"
      >
        <Bell className="size-4" />
        {notificationCount > 0 && (
          <span className="absolute right-1 top-1 flex min-w-[14px] items-center justify-center rounded-full bg-brand-red px-0.5 text-[9px] font-bold leading-none text-white">
            {notificationCount > 9 ? "9+" : notificationCount}
          </span>
        )}
      </button>

      <Separator orientation="vertical" className="h-6" />

      <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center gap-2 rounded-lg px-1.5 py-1 outline-none hover:bg-content">
          <Avatar className="size-7">
            <AvatarFallback className={cn("text-xs font-medium", avatarBgClass)}>
              {user.name.slice(0, 1).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span className="hidden max-w-[120px] truncate text-[13px] font-medium text-[var(--admin-ink)] sm:inline">
            {user.name}
          </span>
          <ChevronDown className="size-3.5 text-text-tertiary" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuGroup>
            <DropdownMenuLabel className="font-normal">
              <p className="truncate text-sm font-medium">{user.name}</p>
              <p className="truncate text-xs text-text-muted">{user.email}</p>
              <p className={cn("mt-0.5 text-xs", roleMetaColor(role))}>
                {getRoleLabel(role)}
              </p>
            </DropdownMenuLabel>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled>
            <UserRound className="size-4" />
            个人资料
          </DropdownMenuItem>
          <DropdownMenuItem disabled>
            <Settings className="size-4" />
            账号设置
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onClick={() => void signOutWithCleanup("/login")}
          >
            <LogOut className="size-4" />
            退出登录
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}

function roleMetaColor(role: UserRole) {
  const theme = getRoleTheme(role);
  switch (theme.accent) {
    case "green":
      return "text-brand-green";
    case "amber":
      return "text-brand-amber";
    case "purple":
      return "text-brand-purple";
    default:
      return "text-brand-blue";
  }
}
