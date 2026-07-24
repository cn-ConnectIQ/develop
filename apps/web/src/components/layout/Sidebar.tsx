"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { signOutWithCleanup } from "@/lib/auth-redirect";
import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ChevronLeft, ChevronRight, LogOut } from "lucide-react";
import { UserRole } from "@connectiq/types";
import {
  getAiOpsNavigation,
  getEventNavigation,
  getPlatformNavigation,
  getRoleLabel,
  shortenEventName,
  type NavItem,
  type NavSubItem,
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
import {
  getOrgSidebarActiveClass,
} from "@/lib/org-switcher-utils";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/brand/BrandLogo";
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

type FlatNavItem = NavItem & { groupKey: string };

function flattenNavItems(
  items: Array<NavItem & { groupKey?: string }>,
): FlatNavItem[] {
  return items.flatMap((item) => {
    const groupKey = item.groupKey ?? "";
    if (item.children?.length) {
      return item.children.map((child) => ({
        ...item,
        label: child.label,
        href: child.href,
        menuKey: child.menuKey,
        external: child.external,
        children: undefined,
        badge: undefined,
        isNew: undefined,
        groupKey,
      }));
    }
    return [{ ...item, groupKey }];
  });
}

function SidebarNavSubItem({
  item,
  active,
  activeClass,
  disabled,
  disabledTitle = "审核通过后可用",
}: {
  item: NavSubItem;
  active: boolean;
  activeClass: string;
  disabled?: boolean;
  disabledTitle?: string;
}) {
  const className = cn(
    "admin-sb-subitem",
    active && "active",
    active && activeClass,
    disabled && "pointer-events-none cursor-not-allowed opacity-50",
  );

  if (disabled) {
    return (
      <span title={disabledTitle} className={className}>
        {item.label}
      </span>
    );
  }

  if (item.external) {
    return (
      <a
        href={item.href}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
      >
        {item.label}
      </a>
    );
  }

  return (
    <Link href={item.href} className={className}>
      {item.label}
    </Link>
  );
}

function SidebarNavParentItem({
  item,
  pathname,
  searchParams,
  hash,
  collapsed,
  activeClass,
  disabled,
  disabledTitle = "审核通过后可用",
}: {
  item: NavItem;
  pathname: string;
  searchParams: { get: (key: string) => string | null } | null;
  hash: string;
  collapsed: boolean;
  activeClass: string;
  disabled?: boolean;
  disabledTitle?: string;
}) {
  const Icon = item.icon;
  const children = item.children ?? [];
  const childActive = children.some((child) =>
    isNavActive(child.href, pathname, searchParams, hash),
  );
  const [open, setOpen] = useState(childActive);

  useEffect(() => {
    if (childActive) setOpen(true);
  }, [childActive, pathname]);

  if (collapsed) {
    const fallback = children[0] ?? item;
    return (
      <SidebarNavItem
        item={{
          ...item,
          label: fallback.label,
          href: fallback.href,
          menuKey: fallback.menuKey,
          children: undefined,
        }}
        active={childActive}
        collapsed
        activeClass={activeClass}
        disabled={disabled}
        disabledTitle={disabledTitle}
      />
    );
  }

  return (
    <div>
      <button
        type="button"
        title={item.label}
        disabled={disabled}
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "admin-sb-item admin-sb-parent",
          childActive && "has-active-child",
          disabled && "cursor-not-allowed opacity-50",
        )}
      >
        <Icon className="admin-sb-icon size-4 shrink-0" />
        <span className="min-w-0 flex-1 truncate text-left">{item.label}</span>
        <ChevronRight
          className={cn(
            "admin-sb-parent-chevron size-3.5 shrink-0",
            open && "open",
          )}
        />
      </button>
      {open && !disabled && (
        <ul className="admin-sb-sublist space-y-0.5">
          {children.map((child) => (
            <li key={child.href}>
              <SidebarNavSubItem
                item={child}
                active={isNavActive(child.href, pathname, searchParams, hash)}
                activeClass={activeClass}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SidebarNavEntry({
  item,
  pathname,
  searchParams,
  hash,
  collapsed,
  activeClass,
  disabled,
  disabledTitle,
}: {
  item: NavItem;
  pathname: string;
  searchParams: { get: (key: string) => string | null } | null;
  hash: string;
  collapsed: boolean;
  activeClass: string;
  disabled?: boolean;
  disabledTitle?: string;
}) {
  if (item.children?.length) {
    return (
      <SidebarNavParentItem
        item={item}
        pathname={pathname}
        searchParams={searchParams}
        hash={hash}
        collapsed={collapsed}
        activeClass={activeClass}
        disabled={disabled}
        disabledTitle={disabledTitle}
      />
    );
  }

  return (
    <SidebarNavItem
      item={item}
      active={isNavActive(item.href, pathname, searchParams, hash)}
      collapsed={collapsed}
      activeClass={activeClass}
      disabled={disabled}
      disabledTitle={disabledTitle}
    />
  );
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
                  : "bg-surface-secondary text-text-secondary",
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
                <SidebarNavEntry
                  item={item}
                  pathname={pathname}
                  searchParams={searchParams}
                  hash={hash}
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
              <li key={`${group.label}-${item.href}-${item.label}`}>
                <SidebarNavEntry
                  item={item}
                  pathname={pathname}
                  searchParams={searchParams}
                  hash={hash}
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
  const sidebarActiveClass = getOrgSidebarActiveClass(
    session?.user?.userType === "ACCOUNT_ADMIN" ? "ORGANIZATION" : session?.user?.activeOrgType,
    session?.user?.userType ?? (role === UserRole.PLATFORM_ADMIN ? "PLATFORM_ADMIN" : undefined),
  );
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

  const showModerationBadge =
    navMode === "platform" &&
    navRole === UserRole.PLATFORM_ADMIN &&
    !isExhibitorRoute;

  const { data: moderationPending = 0 } = useQuery({
    queryKey: ["platform-moderation-pending"],
    queryFn: async () => {
      const res = await fetch("/api/platform/moderation");
      if (!res.ok) return 0;
      const json = (await res.json()) as { data?: { pendingCount?: number } };
      return json.data?.pendingCount ?? 0;
    },
    enabled: showModerationBadge,
    refetchInterval: 60_000,
  });

  const platformGroupsWithBadges = useMemo(() => {
    if (moderationPending <= 0) return platformGroups;
    return platformGroups.map((group) => ({
      ...group,
      items: group.items.map((item) =>
        item.href === "/moderation"
          ? {
              ...item,
              badge: String(moderationPending),
              badgeVariant: "danger" as const,
            }
          : item,
      ),
    }));
  }, [platformGroups, moderationPending]);

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
        : [...platformGroupsWithBadges, ...aiOpsGroups]
      : eventNav;

  const flatItems = flattenNavItems(
    visibleGroups.flatMap((g) =>
      g.items.map((item) => ({ ...item, groupKey: g.label })),
    ),
  );

  return (
    <aside
      className={cn(
        "admin-sidebar flex h-full shrink-0 flex-col transition-[width,colors] duration-150",
        collapsed ? "w-14" : "w-[220px]",
      )}
    >
      <div className="shrink-0 border-b border-border px-3 pb-3 pt-6">
        {collapsed ? (
          <div className="flex w-full flex-col items-center gap-2">
            <BrandLogo size={32} priority />
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              className="text-text-tertiary hover:bg-surface hover:text-text-primary"
              onClick={onToggleCollapse}
              aria-label="展开侧边栏"
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        ) : (
          <div className="flex items-start gap-2">
            <BrandLogo size={32} priority />
            <div className="flex min-w-0 flex-1 flex-col justify-center">
              <span className="truncate text-sm font-semibold leading-tight text-text-primary">
                玖莅
              </span>
              <span className="truncate text-xs tracking-wide text-text-tertiary">
                管理后台
              </span>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              className="shrink-0 text-text-tertiary hover:bg-surface hover:text-text-primary"
              onClick={onToggleCollapse}
              aria-label="折叠侧边栏"
            >
              <ChevronLeft className="size-4" />
            </Button>
          </div>
        )}
      </div>

      {showPlatformBack && !collapsed && (
        <div className="border-b border-border px-2.5 py-2">
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
        <div className="border-b border-border px-2.5 py-2">
          <Link href={getAccountCenterHref()} className="admin-sb-back">
            <ArrowLeft className="size-3.5 shrink-0" />
            {getAccountCenterLabel()}
          </Link>
        </div>
      )}

      {showAccountCenterBack && collapsed && (
        <div className="flex justify-center border-b border-border py-2">
          <Link
            href={getAccountCenterHref()}
            className="flex size-8 items-center justify-center rounded-md text-text-tertiary transition-colors hover:bg-surface hover:text-text-primary"
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
          <div className="flex items-center gap-2.5">
            <div className="admin-sb-avatar">
              {user.name.slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-text-primary">
                {user.name}
              </p>
              {session?.user?.email ? (
                <p
                  className="truncate text-[11px] text-text-tertiary"
                  title={session.user.email}
                >
                  {session.user.email}
                </p>
              ) : null}
              <p className="truncate text-xs text-text-tertiary">
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
              className="shrink-0 text-text-tertiary hover:bg-surface hover:text-text-primary"
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
