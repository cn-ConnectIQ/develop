"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOutWithCleanup } from "@/lib/auth-redirect";
import { useQuery } from "@tanstack/react-query";
import {
  Bot,
  CalendarCheck,
  ChevronLeft,
  ChevronRight,
  Coins,
  LayoutDashboard,
  LogOut,
  Shield,
  Tag,
  UserPlus,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { AdminUser } from "@/components/admin/admin-sidebar";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/layout/Header";
import { EventProvider } from "@/hooks/useCurrentEvent";
import { cn } from "@/lib/utils";

type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  badgeKey?: "applications" | "eventReviews";
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

const NAV_GROUPS: NavGroup[] = [
  {
    label: "平台概览",
    items: [
      { label: "平台概览", href: "/platform/overview", icon: LayoutDashboard },
    ],
  },
  {
    label: "审核中心",
    items: [
      {
        label: "账号申请审核",
        href: "/platform/applications",
        icon: UserPlus,
        badgeKey: "applications",
      },
      {
        label: "活动发布审核",
        href: "/platform/event-reviews",
        icon: CalendarCheck,
        badgeKey: "eventReviews",
      },
    ],
  },
  {
    label: "用户管理",
    items: [
      { label: "全平台用户", href: "/platform/users", icon: Users },
      { label: "内容审核", href: "/moderation", icon: Shield },
    ],
  },
  {
    label: "平台数据",
    items: [
      { label: "AI 运营中心", href: "/platform/ai-ops/matching", icon: Bot },
      { label: "积分管理", href: "/platform/points", icon: Coins },
      { label: "意图标签库", href: "/intent-tags", icon: Tag },
    ],
  },
];

async function fetchBadgeCounts() {
  const res = await fetch("/api/platform/overview-stats");
  if (!res.ok) return { applications: 0, eventReviews: 0 };
  const json = await res.json();
  return {
    applications: json.data?.users?.pending_applications ?? 0,
    eventReviews: json.data?.events?.pending_review ?? 0,
  };
}

function PlatformSidebar({
  user,
  collapsed,
  onToggleCollapse,
}: {
  user: AdminUser;
  collapsed: boolean;
  onToggleCollapse: () => void;
}) {
  const pathname = usePathname();
  const { data: badges } = useQuery({
    queryKey: ["platform-nav-badges"],
    queryFn: fetchBadgeCounts,
    refetchInterval: 60_000,
  });

  return (
    <aside
      className={cn(
        "flex h-full shrink-0 flex-col bg-[#0D1117] transition-[width] duration-200",
        collapsed ? "w-[68px]" : "w-[240px]",
      )}
    >
      <div className="flex h-14 shrink-0 items-center gap-2 border-b border-white/10 px-4">
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-white">ConnectIQ Platform</p>
            <span className="mt-0.5 inline-block rounded bg-brand-gold/20 px-1.5 py-0.5 text-[10px] font-medium text-brand-gold">
              超级管理员
            </span>
          </div>
        )}
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="shrink-0 text-white/50 hover:bg-white/10 hover:text-white"
          onClick={onToggleCollapse}
        >
          {collapsed ? (
            <ChevronRight className="size-4" />
          ) : (
            <ChevronLeft className="size-4" />
          )}
        </Button>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-4">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="mb-5 last:mb-0">
            {!collapsed && (
              <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-wider text-white/35">
                {group.label}
              </p>
            )}
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active =
                  pathname === item.href ||
                  pathname.startsWith(`${item.href}/`);
                const Icon = item.icon;
                const badge =
                  item.badgeKey === "applications"
                    ? badges?.applications
                    : item.badgeKey === "eventReviews"
                      ? badges?.eventReviews
                      : 0;

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      title={collapsed ? item.label : undefined}
                      className={cn(
                        "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] transition-colors",
                        active
                          ? "border border-brand-gold/30 bg-brand-gold/10 font-medium text-brand-gold"
                          : "text-[#c9d1d9] hover:bg-white/5 hover:text-white",
                        collapsed && "justify-center px-2",
                      )}
                    >
                      <Icon className="size-4 shrink-0" />
                      {!collapsed && (
                        <>
                          <span className="min-w-0 flex-1 truncate">
                            {item.label}
                          </span>
                          {badge ? (
                            <span className="rounded bg-brand-red px-1.5 py-0.5 text-[10px] font-semibold text-white">
                              {badge}
                            </span>
                          ) : null}
                        </>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="shrink-0 border-t border-white/10 p-3">
        <div
          className={cn(
            "flex items-center gap-2.5 rounded-lg px-2 py-2",
            collapsed && "justify-center",
          )}
        >
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-gold/20 text-[12px] font-semibold text-brand-gold">
            {user.name.slice(0, 1).toUpperCase()}
          </div>
          {!collapsed && (
            <>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-white">
                  {user.name}
                </p>
                <p className="truncate text-[11px] text-white/45">
                  平台超级管理员
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
            </>
          )}
        </div>
      </div>
    </aside>
  );
}

type PlatformAdminLayoutProps = {
  user: AdminUser;
  children: React.ReactNode;
};

export function PlatformAdminLayout({
  user,
  children,
}: PlatformAdminLayoutProps) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <EventProvider>
      <div className="flex h-screen overflow-hidden bg-content-bg">
        <PlatformSidebar
          user={user}
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed((v) => !v)}
        />
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <Header user={user} />
          <main className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
            {children}
          </main>
        </div>
      </div>
    </EventProvider>
  );
}
