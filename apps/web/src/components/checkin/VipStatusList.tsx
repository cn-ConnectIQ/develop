"use client";

import { format } from "date-fns";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import type { VipStatusItem } from "@/lib/checkin-types";
import { cn } from "@/lib/utils";

type VipStatusListProps = {
  items: VipStatusItem[];
  isLoading?: boolean;
};

export function VipStatusList({ items, isLoading }: VipStatusListProps) {
  if (isLoading) {
    return (
      <div className="mb-6 rounded-xl border border-border-light bg-white p-4">
        <Skeleton className="mb-4 h-5 w-32" />
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mb-6 rounded-xl border border-border-light border-l-[3px] border-l-brand-gold bg-white p-4">
      <h2 className="mb-4 text-sm font-semibold">VIP 到场状态</h2>
      {items.length === 0 ? (
        <p className="py-6 text-center text-sm text-text-muted">暂无 VIP 参会者</p>
      ) : (
        <ul className="space-y-1">
          {items.map((item) => (
            <li
              key={item.id}
              className={cn(
                "flex items-center gap-3 rounded-lg px-2 py-2.5",
                !item.checkedIn && "bg-[#FFFDF0]",
              )}
            >
              <Avatar className="size-8">
                <AvatarFallback className="text-xs">
                  {item.name.slice(0, 1)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{item.name}</p>
                <p className="truncate text-xs text-text-muted">
                  {item.company ?? "—"}
                </p>
              </div>
              <span
                className={cn(
                  "shrink-0 text-xs font-medium",
                  item.checkedIn ? "text-brand-green" : "text-brand-amber",
                )}
              >
                {item.checkedIn
                  ? item.checkedInAt
                    ? `已到场 ${format(new Date(item.checkedInAt), "HH:mm")}`
                    : "已到场"
                  : "未到场"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
