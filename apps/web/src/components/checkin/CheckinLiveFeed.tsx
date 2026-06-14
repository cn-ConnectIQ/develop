"use client";

import { useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { CheckinFeedItem } from "@/lib/checkin-types";
import { cn } from "@/lib/utils";

type CheckinLiveFeedProps = {
  items: CheckinFeedItem[];
  isLoading?: boolean;
  title?: string;
  maxHeightClass?: string;
  animateFrom?: "top" | "bottom";
};

export function CheckinLiveFeed({
  items,
  isLoading,
  title = "实时签到流",
  maxHeightClass = "max-h-72",
  animateFrom = "top",
}: CheckinLiveFeedProps) {
  const prevIdsRef = useRef<Set<string>>(new Set());
  const [animatingIds, setAnimatingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const currentIds = new Set(items.map((i) => i.id));
    const newOnes = items
      .filter((i) => !prevIdsRef.current.has(i.id))
      .map((i) => i.id);

    if (newOnes.length > 0 && prevIdsRef.current.size > 0) {
      setAnimatingIds((prev) => new Set([...prev, ...newOnes]));
      const timer = setTimeout(() => {
        setAnimatingIds((prev) => {
          const next = new Set(prev);
          newOnes.forEach((id) => next.delete(id));
          return next;
        });
      }, 600);
      prevIdsRef.current = currentIds;
      return () => clearTimeout(timer);
    }

    prevIdsRef.current = currentIds;
  }, [items]);

  if (isLoading) {
    return (
      <div className="rounded-xl border border-border-light bg-white p-4">
        <Skeleton className="mb-4 h-5 w-28" />
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </div>
    );
  }

  const slideClass =
    animateFrom === "top"
      ? "animate-in slide-in-from-top-2 fade-in duration-300"
      : "animate-in slide-in-from-bottom-4 fade-in duration-300";

  return (
    <div className="rounded-xl border border-border-light bg-white p-4">
      <h2 className="mb-4 text-sm font-semibold">{title}</h2>
      {items.length === 0 ? (
        <p className="py-8 text-center text-sm text-text-muted">暂无签到记录</p>
      ) : (
        <ul className={cn("space-y-1 overflow-y-auto", maxHeightClass)}>
          {items.map((item) => {
            const isVip =
              item.isVip ?? item.ticketType.toUpperCase().includes("VIP");
            const isNew = animatingIds.has(item.id);

            return (
              <li
                key={item.id}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-2 py-2.5",
                  isVip && "bg-[#FFFDF0]",
                  isNew && slideClass,
                )}
              >
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
                    isVip &&
                      "border-brand-gold/30 bg-brand-gold/10 text-brand-gold",
                  )}
                >
                  {item.ticketType}
                </Badge>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
