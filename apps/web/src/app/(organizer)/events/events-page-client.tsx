"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CalendarDays, Plus } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { AdminPageBody } from "@/components/layout/AdminLayout";
import { PageHead } from "@/components/admin/page-head";
import { EventCard, EventCardSkeleton } from "@/components/events/EventCard";
import { CreateEventSheet } from "@/components/events/CreateEventSheet";
import { useEvents, type EventListItem } from "@/hooks/useEvents";
import { getEventPhase, sortEventsByPhase } from "@/lib/event-utils";
import { cn } from "@/lib/utils";

type TabFilter = "all" | "today" | "live" | "upcoming" | "draft" | "ended";

const tabs: Array<{ id: TabFilter; label: string }> = [
  { id: "all", label: "全部" },
  { id: "today", label: "今天" },
  { id: "live", label: "进行中" },
  { id: "upcoming", label: "即将举行" },
  { id: "draft", label: "筹备中" },
  { id: "ended", label: "已结束" },
];

export function EventsPageClient() {
  const [tab, setTab] = useState<TabFilter>("all");
  const [editEvent, setEditEvent] = useState<EventListItem | null>(null);
  const { data, isLoading } = useEvents();

  const events = data?.data.events ?? [];
  const stats = data?.data.stats ?? {
    live: 0,
    today: 0,
    upcoming: 0,
    draft: 0,
    ended: 0,
  };

  const filtered = useMemo(() => {
    const list =
      tab === "all"
        ? events
        : events.filter((event) => {
            const phase = getEventPhase({
              status: event.status as "DRAFT" | "PUBLISHED" | "ARCHIVED",
              startDate: event.startDate ? new Date(event.startDate) : null,
              endDate: event.endDate ? new Date(event.endDate) : null,
            });
            if (tab === "upcoming") {
              return phase === "upcoming" || phase === "today";
            }
            return phase === tab;
          });
    return sortEventsByPhase(list);
  }, [events, tab]);

  return (
    <AdminPageBody>
      <PageHead
        title="我的活动"
        description="管理您主办或参展的会议与展会"
        actions={
          <Link href="/events/new" className={cn(buttonVariants())}>
            <Plus className="mr-1 size-4" />
            创建活动
          </Link>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="进行中" value={stats.live} valueClass="text-brand-green" />
        <StatTile label="即将举行" value={stats.upcoming + stats.today} valueClass="text-brand-blue" />
        <StatTile label="筹备中" value={stats.draft} valueClass="text-text-muted" />
        <StatTile label="已结束" value={stats.ended} valueClass="text-text-tertiary" />
      </div>

      <div className="flex flex-wrap gap-2">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            className={cn("admin-chip", tab === item.id && "active")}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {isLoading &&
          Array.from({ length: 3 }).map((_, i) => (
            <EventCardSkeleton key={i} />
          ))}

        {!isLoading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-xl border border-border-light bg-white py-16 text-center">
            <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-brand-blue-light">
              <CalendarDays className="size-6 text-brand-blue" />
            </div>
            <p className="text-sm font-medium text-[var(--admin-ink)]">
              暂无活动
            </p>
            <p className="mt-1 text-sm text-text-muted">
              创建您的第一个活动，开始管理参会者与现场执行
            </p>
            <Link
              href="/events/new"
              className={cn(
                buttonVariants(),
                "mt-4 bg-brand-blue text-white hover:bg-brand-blue/90",
              )}
            >
              <Plus className="mr-1 size-4" />
              创建活动
            </Link>
          </div>
        )}

        {filtered.map((event) => (
          <EventCard
            key={event.id}
            event={event}
            onEdit={(e) => {
              setEditEvent(e);
            }}
          />
        ))}
      </div>

      <CreateEventSheet
        open={!!editEvent}
        onOpenChange={(open) => {
          if (!open) setEditEvent(null);
        }}
        editEvent={editEvent}
      />
    </AdminPageBody>
  );
}

function StatTile({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: number;
  valueClass: string;
}) {
  return (
    <div className="admin-card admin-card-pad-lg">
      <p className="text-[12.5px] text-[var(--admin-gray)]">{label}</p>
      <p className={cn("admin-metric-num mt-2", valueClass)}>{value}</p>
    </div>
  );
}
