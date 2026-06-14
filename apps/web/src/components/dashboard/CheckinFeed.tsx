"use client";

import { format } from "date-fns";
import { RefreshCw } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export type CheckinFeedItem = {
  id: string;
  checkedInAt: string;
  name: string;
  company: string | null;
  ticketType: string;
  isVip?: boolean;
};

type CheckinFeedProps = {
  items: CheckinFeedItem[];
  isLoading?: boolean;
  onRefresh?: () => void;
  isRefreshing?: boolean;
};

export function CheckinFeed({
  items,
  isLoading,
  onRefresh,
  isRefreshing,
}: CheckinFeedProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-[15px] font-semibold">最新签到动态</h2>
        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            className="rounded-md p-1.5 text-text-muted transition-colors hover:bg-gray-100 hover:text-brand-blue"
            aria-label="刷新签到动态"
          >
            <RefreshCw
              className={cn("size-4", isRefreshing && "animate-spin")}
            />
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <p className="py-8 text-center text-sm text-text-muted">暂无签到记录</p>
      ) : (
        <ul className="max-h-64 space-y-1 overflow-y-auto">
          {items.map((item) => {
            const isVip = item.isVip ?? item.ticketType.toUpperCase().includes("VIP");
            return (
              <li
                key={item.id}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-2 py-2.5",
                  isVip && "bg-[#FFFDF0]",
                )}
              >
                <span className="size-2 shrink-0 rounded-full bg-brand-green" />
                <span className="w-10 shrink-0 text-xs tabular-nums text-text-muted">
                  {format(new Date(item.checkedInAt), "HH:mm")}
                </span>
                <Avatar className="size-7">
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
                <Badge
                  variant="secondary"
                  className={cn(
                    "shrink-0 text-[10px]",
                    isVip && "border-brand-gold/30 bg-brand-gold/10 text-brand-gold",
                  )}
                >
                  {item.ticketType}
                </Badge>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
