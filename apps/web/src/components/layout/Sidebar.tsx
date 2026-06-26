"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { signOutWithCleanup } from "@/lib/auth-redirect";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
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
  extractEventIdFromPath,
  getAccountCenterHref,
  getAccountCenterLabel,
  getAdminNavMode,
  getPlatformHomeHref,
  getPlatformHomeLabel,
  isNavItemActive,
} from "@/lib/nav-context";
import { resolveEventNavRole, resolvePlatformNavRole } from "@/lib/nav-role";
import { getRoleTheme } from "@/lib/role-theme";
import {
  getOrgLogoGradient,
  getOrgSidebarActiveClass,
} from "@/lib/org-switcher-utils";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { AdminUser } from "@/components/admin/admin-sidebar";
import { SidebarEventSwitcher } from "@/components/layout/SidebarEventSwitcher";
import { useEventFeatureFlags } from "@/hooks/useEventFeatureFlags";

type SidebarProps = {
  user: AdminUser;
  collapsed: boolean;
  onToggleCollapse: () => void;
  eventId?: string | null;
  eventName?: string | null;
  eventType?: string | null;
  activityType?: string | null;
  reviewLocked?: boolean;
};

const REVIEW_LOCKED_GROUPS = new Set(["互动管理", "Speed Networking"]);

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
  disabled,
  disabledTitle = "审核通过后可用",
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
  activeClass: string;
  disabled?: boolean;
  disabledTitle?: string;
}) {
  const Icon = item.icon;
  const className = cn(
    "admin-sb-item",
    active && "active",
    active && activeClass,
    collapsed && "justify-center px-2",
    disabled && "cursor-not-allowed opacity-50",
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

  if (disabled) {
    return (
      <span
        title={collapsed ? item.label : disabledTitle}
        className={className}
      >
        {content}
      </span>
    );
  }

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
  reviewLocked,
}: {
  groups: ReturnType<typeof getEventNavigation>;
  pathname: string;
  collapsed: boolean;
  activeClass: string;
  eventName?: string | null;
  searchParams: { get: (key: string) => string | null } | null;
  hash: string;
  reviewLocked?: boolean;
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
                  disabled={
                    reviewLocked && REVIEW_LOCKED_GROUPS.has(group.label)
                  }
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
  activityType,
  reviewLocked,
}: SidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const [hash, setHash] = useState("");

  useEffect(() => {
    const syncHash = () => setHash(window.location.hash.replace(/^#/, ""));
    syncHash();
    window.addEventListener("hashchange", syncHash);
    return () => window.removeEventListener("hashchange", syncHash);
  }, [pathname]);

  const role = user.role as UserRole;
  const userType = session?.user?.userType;
  const navMode = getAdminNavMode(pathname);
  const hasPlatformAdmin = user.hasPlatformAdmin ?? role === "PLATFORM_ADMIN";
  const navRole = resolvePlatformNavRole(userType, role);
  const isExhibitorRoute = pathname.startsWith("/exhibitor");
  const eventNavRole = resolveEventNavRole({
    activityType,
    eventType,
    isExhibitorRoute,
    userType,
  });
  const theme = getRoleTheme(navRole);
  const sidebarActiveClass = getOrgSidebarActiveClass(
    session?.user?.userType === "ACCOUNT_ADMIN" ? "ORGANIZATION" : session?.user?.activeOrgType,
    session?.user?.userType ?? (role === UserRole.PLATFORM_ADMIN ? "PLATFORM_ADMIN" : undefined),
  );
  const logoGradient =
    session?.user?.userType === "ACCOUNT_ADMIN"
      ? getOrgLogoGradient("ORGANIZATION")
      : theme.logoGradient;

  const exhibitorBoothId = isExhibitorRoute
    ? (session?.user?.boothId ??
      user.entityId ??
      extractEventIdFromPath(pathname))
    : null;

  const resolvedEventId =
    navMode === "event" && !isExhibitorRoute
      ? (eventId ?? extractEventIdFromPath(pathname))
      : null;

  const navContextId =
    eventNavRole === UserRole.EXHIBITOR
      ? (exhibitorBoothId ?? resolvedEventId)
      : resolvedEventId;

  const { data: featureFlags } = useEventFeatureFlags(
    eventNavRole === UserRole.EXHIBITOR ? null : resolvedEventId,
  );

  const platformGroups = getPlatformNavigation(navRole);
  const eventNav = navContextId
    ? getEventNavigation(
        eventNavRole,
        navContextId,
        eventType,
        eventNavRole === UserRole.EXHIBITOR
          ? (session?.user?.boothEventName ?? eventName)
          : eventName,
        featureFlags,
        activityType,
      )
    : [];

  const aiOpsGroups =
    navMode === "platform" &&
    navRole === UserRole.PLATFORM_ADMIN &&
    pathname.startsWith("/platform/ai-ops")
      ? [getAiOpsNavigation()]
      : [];

  const showEventContext =
    navMode === "event" &&
    !isExhibitorRoute &&
    (navRole === UserRole.PLATFORM_ADMIN || userType === "ACCOUNT_ADMIN");

  const showPlatformBack =
    navMode === "event" &&
    userType !== "ACCOUNT_ADMIN" &&
    (navRole === UserRole.PLATFORM_ADMIN ||
      eventNavRole === UserRole.EXPO_ORGANIZER ||
      (eventNavRole === UserRole.ORGANIZER && hasPlatformAdmin));

  const showAccountCenterBack =
    navMode === "event" && userType === "ACCOUNT_ADMIN";

  const visibleGroups =
    navMode === "platform"
      ? isExhibitorRoute && eventNav.length > 0
        ? eventNav
        : [...platformGroups, ...aiOpsGroups]
      : eventNav;

  const flatItems = visibleGroups.flatMap((g) =>
    g.items.map((item) => ({ ...item, groupKey: g.label })),
  );

  return (
    <aside
      className={cn(
        "admin-sidebar flex h-full shrink-0 flex-col transition-[width,colors] duration-150",
        collapsed ? "w-14" : "w-[220px]",
      )}
    >
      <div className="flex h-14 shrink-0 items-center border-b border-white/10 px-3">
        {collapsed ? (
          <div className="flex w-full flex-col items-center gap-1">
            <div
              className={cn(
                "admin-sb-logo flex size-8 items-center justify-center text-sm font-bold",
                `bg-gradient-to-br ${logoGradient}`,
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

      {showAccountCenterBack && !collapsed && (
        <div className="border-b border-white/[0.08] px-2.5 py-2">
          <Link href={getAccountCenterHref()} className="admin-sb-back">
            <ArrowLeft className="size-3.5 shrink-0" />
            {getAccountCenterLabel()}
          </Link>
        </div>
      )}

      {showAccountCenterBack && collapsed && (
        <div className="flex justify-center border-b border-white/[0.08] py-2">
          <Link
            href={getAccountCenterHref()}
            className="flex size-8 items-center justify-center rounded-lg text-white/60 transition-colors hover:bg-white/10 hover:text-white"
            title={getAccountCenterLabel()}
            aria-label={getAccountCenterLabel()}
          >
            <ArrowLeft className="size-4" />
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
                  activeClass={sidebarActiveClass}
                />
              </li>
            ))}
          </ul>
        ) : navMode === "platform" ? (
          <NavGroups
            groups={[...platformGroups, ...aiOpsGroups]}
            pathname={pathname}
            collapsed={false}
            activeClass={sidebarActiveClass}
            searchParams={searchParams}
            hash={hash}
          />
        ) : (
          <EventNavGroups
            groups={eventNav}
            pathname={pathname}
            collapsed={false}
            activeClass={sidebarActiveClass}
            searchParams={searchParams}
            hash={hash}
            reviewLocked={reviewLocked}
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
                logoGradient,
              )}
            >
              {user.name.slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium text-white">
                {user.name}
              </p>
              <p className="truncate text-[11px] text-white/45">
                {userType === "ACCOUNT_ADMIN"
                  ? "账号管理员"
                  : eventNavRole === UserRole.EXHIBITOR && eventName
                    ? eventName
                    : getRoleLabel(navRole)}
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              className="shrink-0 text-white/50 hover:bg-white/10 hover:text-white"
              onClick={() => void signOutWithCleanup("/login")}
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
