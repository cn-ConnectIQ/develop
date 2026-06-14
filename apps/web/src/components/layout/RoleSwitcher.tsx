"use client";

import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, Check } from "lucide-react";
import { toast } from "sonner";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ROLE_META } from "@/lib/role-utils";
import { getRoleTheme } from "@/lib/role-theme";
import { cn } from "@/lib/utils";
import type { UserRole } from "@connectiq/types";

type RoleItem = {
  role: UserRole;
  entityId: string | null;
  entityName: string | null;
  emoji: string;
  label: string;
  colorClass: string;
  homePath: string;
  isActive: boolean;
};

async function fetchRoles() {
  const res = await fetch("/api/me/roles");
  if (!res.ok) throw new Error("加载角色失败");
  return (await res.json()).data as { roles: RoleItem[] };
}

export function RoleSwitcher() {
  const router = useRouter();
  const { data: session, update } = useSession();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["me-roles"],
    queryFn: fetchRoles,
  });

  const roles = data?.roles ?? [];
  const active =
    roles.find((r) => r.isActive) ??
    (session?.user?.role
      ? {
          ...ROLE_META[session.user.role],
          role: session.user.role,
          entityId: session.user.entityId,
          entityName: null,
          homePath: "/",
          isActive: true,
        }
      : null);

  async function switchRole(item: RoleItem) {
    if (item.isActive) return;

    const res = await fetch("/api/me/switch-role", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        role: item.role,
        entityId: item.entityId,
      }),
    });

    const json = await res.json();
    if (!res.ok) {
      toast.error(json.error ?? "切换失败");
      return;
    }

    await update({
      role: item.role,
      entityId: item.entityId,
    });

    void queryClient.invalidateQueries({ queryKey: ["me-roles"] });
    toast.success(`已切换为${item.label}`);
    router.push(json.data.redirectPath);
    router.refresh();
  }

  if (isLoading || !active) return null;

  const hasMultiple = roles.length > 1;

  return (
    <Popover>
      <PopoverTrigger
        disabled={!hasMultiple}
        className={cn(
          "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-border-light bg-white px-3 text-sm font-medium",
          active.colorClass,
          !hasMultiple && "cursor-default",
        )}
      >
        <span>{active.emoji}</span>
        <span className="hidden sm:inline">{active.label}</span>
        {hasMultiple && <ChevronDown className="size-3.5 text-text-tertiary" />}
      </PopoverTrigger>
      {hasMultiple && (
        <PopoverContent align="start" className="w-72 p-1">
          <p className="px-2 py-1.5 text-xs font-medium text-text-muted">
            切换角色
          </p>
          {roles.map((item) => {
            const itemTheme = getRoleTheme(item.role);
            return (
              <button
                key={`${item.role}-${item.entityId ?? "global"}`}
                type="button"
                onClick={() => void switchRole(item)}
                className={cn(
                  "flex w-full items-start gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-muted",
                  item.isActive && itemTheme.switcherHighlight,
                )}
              >
                <span className="mt-0.5">{item.emoji}</span>
                <div className="min-w-0 flex-1">
                  <p className={cn("font-medium", item.colorClass)}>
                    {item.label}
                  </p>
                  {item.entityName && (
                    <p className="truncate text-xs text-text-muted">
                      {item.entityName}
                    </p>
                  )}
                </div>
                {item.isActive && (
                  <Check className="mt-0.5 size-4 shrink-0 text-brand-green" />
                )}
              </button>
            );
          })}
        </PopoverContent>
      )}
    </Popover>
  );
}
