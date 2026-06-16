"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOutWithCleanup } from "@/lib/auth-redirect";
import { LogOut } from "lucide-react";
import type { UserRole } from "@connectiq/types";
import { getNavigation, getRoleLabel } from "@/config/navigation";
import { cn } from "@/lib/utils";
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
      <div className="flex h-14 shrink-0 items-center gap-2.5 border-b border-white/10 px-5">
        <div className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-blue to-brand-purple text-[13px] font-bold text-white">
          C
        </div>
        <div className="min-w-0">
          <p className="truncate text-[14px] font-semibold text-white">
            ConnectIQ
          </p>
          <p className="truncate text-[11px] text-white/50">管理后台</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {groups.map((group) => (
          <div key={group.label} className="mb-5 last:mb-0">
            <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-wider text-white/35">
              {group.label}
            </p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = isActive(item.href, pathname);
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] transition-colors",
                        active
                          ? "bg-[var(--admin-sidebar-accent)] font-medium text-white"
                          : "text-[#c9cce0] hover:bg-white/5 hover:text-white",
                      )}
                    >
                      <Icon className="size-4 shrink-0 opacity-80" />
                      <span className="flex-1 truncate">{item.label}</span>
                      {item.isNew && (
                        <span className="rounded bg-brand-purple px-1.5 py-0.5 text-[9px] font-semibold text-white">
                          NEW
                        </span>
                      )}
                      {item.badge && (
                        <span className="rounded bg-brand-gold/20 px-1.5 py-0.5 text-[9px] font-semibold text-brand-gold">
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

      <div className="shrink-0 border-t border-white/10 p-3">
        <div className="flex items-center gap-2.5 rounded-lg px-2 py-2">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[var(--admin-sidebar-accent)] text-[12px] font-semibold text-white">
            {user.name.slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium text-white">
              {user.name}
            </p>
            <p className="truncate text-[11px] text-white/45">
              {getRoleLabel(user.role)}
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
    </aside>
  );
}
