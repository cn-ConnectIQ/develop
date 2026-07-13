"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOutWithCleanup } from "@/lib/auth-redirect";
import { LogOut } from "lucide-react";
import type { UserRole } from "@connectiq/types";
import { getNavigation, getRoleLabel } from "@/config/navigation";
import { cn } from "@/lib/utils";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { Button } from "@/components/ui/button";

export type AdminUser = {
  name: string;
  email: string;
  role: UserRole;
  entityId: string | null;
  hasPlatformAdmin?: boolean;
};

type AdminSidebarProps = {
  user: AdminUser;
};

function isActive(href: string, pathname: string) {
  const base = href.split("#")[0];
  if (base === "/overview") return pathname === "/overview";
  return pathname === base || pathname.startsWith(`${base}/`);
}

export function AdminSidebar({ user }: AdminSidebarProps) {
  const pathname = usePathname();
  const groups = getNavigation(user.role, user.entityId);

  return (
    <aside className="admin-sidebar">
      <div className="admin-sb-brand border-b border-border">
        <BrandLogo size={32} priority />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-text-primary">玖莅</p>
          <p className="truncate text-xs text-text-tertiary">管理后台</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-2">
        {groups.map((group) => (
          <div key={group.label}>
            <p className="admin-sb-label">{group.label}</p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = isActive(item.href, pathname);
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn("admin-sb-item", active && "active active-green")}
                    >
                      <Icon className="admin-sb-icon size-4 shrink-0" />
                      <span className="flex-1 truncate">{item.label}</span>
                      {item.isNew && <span className="admin-sb-chip">新</span>}
                      {item.badge && (
                        <span className="rounded bg-brand-amber-light px-1.5 py-0.5 text-[9px] font-semibold text-brand-amber">
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="admin-sb-foot shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="admin-sb-avatar">
            {user.name.slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-text-primary">{user.name}</p>
            <p className="truncate text-xs text-text-tertiary">{getRoleLabel(user.role)}</p>
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
    </aside>
  );
}
