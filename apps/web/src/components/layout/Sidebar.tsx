"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { signOut } from "next-auth/react";
import { useEffect, useState } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, LogOut } from "lucide-react";
import { UserRole } from "@connectiq/types";
import {
  getAiOpsNavigation,
  getEventNavigation,
  getPlatformNavigation,
  getRoleLabel,
  shortenEventName,
  type NavItem,
} from "@/config/navigation";
import {
  getAdminNavMode,
  getPlatformHomeHref,
  getPlatformHomeLabel,
  isNavItemActive,
} from "@/lib/nav-context";
import { getRoleTheme } from "@/lib/role-theme";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { AdminUser } from "@/components/admin/admin-sidebar";
import { SidebarEventSwitcher } from "@/components/layout/SidebarEventSwitcher";

type SidebarProps = {
  user: AdminUser;
  collapsed: boolean;
  onToggleCollapse: () => void;
  eventId?: string | null;
  eventName?: string | null;
  eventType?: string | null;
};

function isNavActive(
  href: string,
  pathname: string,
  searchParams: { get: (key: string) => string | null } | null,
  hash: string,
) {
  return isNavItemActive(href, pathname, searchParams, hash);
}

function SidebarNavItem({
  item,
  active,
  collapsed,
  activeClass,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
  activeClass: string;
}) {
  const Icon = item.icon;
  const className = cn(
    "admin-sb-item",
    active && "active",
    active && activeClass,
    collapsed && "justify-center px-2",
  );

  const content = (
    <>
      <Icon className="admin-sb-icon size-4 shrink-0" />
      {!collapsed && (
        <>
          <span className="min-w-0 flex-1 truncate">{item.label}</span>
          {item.badge && (
            <span
              className={cn(
                "ml-auto shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
                item.badgeVariant === "danger"
                  ? "bg-brand-red text-white"
                  : "bg-white/10 text-white/80",
              )}
            >
              {item.badge}
            </span>
          )}
          {item.isNew && <span className="admin-sb-chip">新</span>}
        </>
      )}
    </>
  );

  if (item.external) {
    return (
      <a
        href={item.href}
        target="_blank"
        rel="noopener noreferrer"
        title={collapsed ? item.label : undefined}
        className={className}
      >
        {content}
      </a>
    );
  }

  return (
    <Link
      href={item.href}
      title={collapsed ? item.label : undefined}
      className={className}
    >
      {content}
    </Link>
  );
}

function NavGroups({
  groups,
  pathname,
  collapsed,
  activeClass,
  searchParams,
  hash,
}: {
  groups: ReturnType<typeof getPlatformNavigation>;
  pathname: string;
  collapsed: boolean;
  activeClass: string;
  searchParams: { get: (key: string) => string | null } | null;
  hash: string;
}) {
  return (
    <>
      {groups.map((group) => (
        <div key={group.label}>
          {!collapsed && (
            <p className="admin-sb-label first:mt-0">{group.label}</p>
          )}
          <ul className="space-y-0.5">
            {group.items.map((item) => (
              <li key={`${group.label}-${item.href}-${item.label}`}>
                <SidebarNavItem
                  item={item}
                  active={isNavActive(item.href, pathname, searchParams, hash)}
                  collapsed={collapsed}
                  activeClass={activeClass}
                />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </>
  );
}

function EventNavGroups({
  groups,
  pathname,
  collapsed,
  activeClass,
  eventName,
  searchParams,
  hash,
}: {
  groups: ReturnType<typeof getEventNavigation>;
  pathname: string;
  collapsed: boolean;
  activeClass: string;
  eventName?: string | null;
  searchParams: { get: (key: string) => string | null } | null;
  hash: string;
}) {
  return (
    <>
      {!collapsed && eventName && (
        <p className="admin-sb-label mt-0">
          {shortenEventName(eventName, 12)}
        </p>
      )}
      {groups.map((group) => (
        <div key={group.label}>
          {!collapsed && (
            <p className="admin-sb-label">{group.label}</p>
          )}
          <ul className="space-y-0.5">
            {group.items.map((item) => (
              <li key={`${group.label}-${item.href}`}>
                <SidebarNavItem
                  item={item}
                  active={isNavActive(item.href, pathname, searchParams, hash)}
                  collapsed={collapsed}
                  activeClass={activeClass}
                />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </>
  );
}

export function Sidebar({
  user,
  collapsed,
  onToggleCollapse,
  eventId,
  eventName,
  eventType,
}: SidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [hash, setHash] = useState("");

  useEffect(() => {
    const syncHash = () => setHash(window.location.hash.replace(/^#/, ""));
    syncHash();
    window.addEventListener("hashchange", syncHash);
    return () => window.removeEventListener("hashchange", syncHash);
  }, [pathname]);

  const role = user.role as UserRole;
  const navMode = getAdminNavMode(pathname);
  const hasPlatformAdmin = user.hasPlatformAdmin ?? role === "PLATFORM_ADMIN";
  const navRole =
    navMode === "platform" && hasPlatformAdmin
      ? UserRole.PLATFORM_ADMIN
      : role;
  const theme = getRoleTheme(role);

  const resolvedEventId =
    navMode === "event"
      ? (eventId ??
        (role === "EXPO_ORGANIZER" || role === "EXHIBITOR"
          ? user.entityId
          : null))
      : null;

  const platformGroups = getPlatformNavigation(navRole);
  const eventGroups =
    navMode === "event" && resolvedEventId
      ? getEventNavigation(role, resolvedEventId, eventType, eventName)
      : [];

  const aiOpsGroups =
    navMode === "platform" &&
    navRole === UserRole.PLATFORM_ADMIN &&
    pathname.startsWith("/platform/ai-ops")
      ? [getAiOpsNavigation()]
      : [];

  const showEventContext =
    navMode === "event" &&
    (role === UserRole.PLATFORM_ADMIN ||
      role === UserRole.ORGANIZER ||
      role === UserRole.EXPO_ORGANIZER);

  const showPlatformBack =
    navMode === "event" &&
    (role === UserRole.PLATFORM_ADMIN ||
      (role === UserRole.ORGANIZER && hasPlatformAdmin));

  const visibleGroups =
    navMode === "platform"
      ? [...platformGroups, ...aiOpsGroups]
      : eventGroups;

  const flatItems = visibleGroups.flatMap((g) =>
    g.items.map((item) => ({ ...item, groupKey: g.label })),
  );

  return (
    <aside
      className={cn(
        "admin-sidebar flex h-full shrink-0 flex-col transition-[width] duration-200",
        collapsed ? "w-14" : "w-[220px]",
      )}
    >
      <div className="flex h-14 shrink-0 items-center border-b border-white/10 px-3">
        {collapsed ? (
          <div className="flex w-full flex-col items-center gap-1">
            <div
              className={cn(
                "admin-sb-logo flex size-8 items-center justify-center text-sm font-bold",
                `bg-gradient-to-br ${theme.logoGradient}`,
              )}
            >
              C
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              className="text-white/50 hover:bg-white/10 hover:text-white"
              onClick={onToggleCollapse}
              aria-label="展开侧边栏"
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        ) : (
          <>
            <div className="flex min-w-0 flex-1 flex-col justify-center">
              <span className="truncate text-[14.5px] font-semibold leading-tight text-white">
                ConnectIQ
              </span>
              <span className="truncate text-[10px] tracking-widest text-[#7e84a6]">
                管理后台
              </span>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              className="shrink-0 text-white/50 hover:bg-white/10 hover:text-white"
              onClick={onToggleCollapse}
              aria-label="折叠侧边栏"
            >
              <ChevronLeft className="size-4" />
            </Button>
          </>
        )}
      </div>

      {showPlatformBack && !collapsed && (
        <div className="border-b border-white/[0.08] px-2.5 py-2">
          <Link
            href={getPlatformHomeHref(role, hasPlatformAdmin)}
            className="admin-sb-back"
          >
            <ArrowLeft className="size-3.5 shrink-0" />
            {getPlatformHomeLabel(role, hasPlatformAdmin)}
          </Link>
        </div>
      )}

      {showEventContext && !collapsed && <SidebarEventSwitcher role={role} />}

      <nav className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-2 py-2">
        {collapsed ? (
          <ul className="space-y-0.5">
            {flatItems.map((item) => (
              <li key={`${item.groupKey}-${item.href}-${item.label}`}>
                <SidebarNavItem
                  item={item}
                  active={isNavActive(item.href, pathname, searchParams, hash)}
                  collapsed
                  activeClass={theme.activeClass}
                />
              </li>
            ))}
          </ul>
        ) : navMode === "platform" ? (
          <NavGroups
            groups={[...platformGroups, ...aiOpsGroups]}
            pathname={pathname}
            collapsed={false}
            activeClass={theme.activeClass}
            searchParams={searchParams}
            hash={hash}
          />
        ) : (
          <EventNavGroups
            groups={eventGroups}
            pathname={pathname}
            collapsed={false}
            activeClass={theme.activeClass}
            searchParams={searchParams}
            hash={hash}
            eventName={
              role === "EXHIBITOR" ? (eventName ?? "展位工作台") : eventName
            }
          />
        )}
      </nav>

      {!collapsed && (
        <div className="admin-sb-foot shrink-0">
          <div className="flex items-center gap-2.5 rounded-lg px-1 py-1">
            <div
              className={cn(
                "admin-sb-avatar bg-gradient-to-br",
                theme.logoGradient,
              )}
            >
              {user.name.slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium text-white">
                {user.name}
              </p>
              <p className="truncate text-[11px] text-white/45">
                {role === UserRole.EXHIBITOR && eventName
                  ? eventName
                  : getRoleLabel(role)}
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              className="shrink-0 text-white/50 hover:bg-white/10 hover:text-white"
              onClick={() => signOut({ callbackUrl: "/login" })}
              title="退出登录"
            >
              <LogOut className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </aside>
  );
}
