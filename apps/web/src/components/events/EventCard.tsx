"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { differenceInCalendarDays, format } from "date-fns";
import { zhCN } from "date-fns/locale";
import {
  Archive,
  CalendarDays,
  Copy,
  MapPin,
  MoreHorizontal,
  Pencil,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EventStatusBadge } from "@/components/admin/status-badge";
import {
  eventCategoryOptions,
  formatEventDateRange,
  getEventPhase,
  type EventPhase,
} from "@/lib/event-utils";
import { cn } from "@/lib/utils";
import type { EventListItem } from "@/hooks/useEvents";

type EventCardProps = {
  event: EventListItem;
};

const phaseStyles: Record<EventPhase, { border: string; opacity?: string }> = {
  live: { border: "border-l-brand-green" },
  today: { border: "border-l-brand-blue" },
  upcoming: { border: "border-l-brand-blue" },
  draft: { border: "border-l-brand-blue" },
  ended: { border: "border-l-border-light", opacity: "opacity-70" },
};

function getCoverGradient(category: EventListItem["category"], type: string) {
  if (category === "EXPO" || type === "EXPO") {
    return "from-brand-green/30 to-brand-green/10";
  }
  if (category === "SALON") return "from-brand-purple/30 to-brand-purple/10";
  if (category === "TRAINING") return "from-brand-amber/30 to-brand-amber/10";
  return "from-brand-blue/30 to-brand-blue/10";
}

function getCategoryLabel(event: EventListItem) {
  const fromSetting = eventCategoryOptions.find((o) => o.value === event.category);
  if (fromSetting) return fromSetting.label;
  return event.type === "EXPO" ? "展会" : "峰会";
}

export function EventCard({ event }: EventCardProps) {
  const [deleteOpen, setDeleteOpen] = useState(false);

  const phase = getEventPhase({
    status: event.status as "DRAFT" | "PUBLISHED" | "ARCHIVED",
    startDate: event.startDate ? new Date(event.startDate) : null,
    endDate: event.endDate ? new Date(event.endDate) : null,
  });
  const style = phaseStyles[phase];

  const daysUntil =
    event.startDate && phase !== "live" && phase !== "ended"
      ? differenceInCalendarDays(new Date(event.startDate), new Date())
      : null;

  const prepProgress = event.readiness ?? { completed: 0, total: 9 };

  function handlePlaceholder(action: string) {
    toast.info(`${action}功能将在后续版本开放`);
  }

  return (
    <>
      <div
        className={cn(
          "flex items-center gap-4 rounded-xl border border-border-light bg-white p-4 transition-shadow hover:shadow-[0_2px_8px_rgba(26,26,46,0.06)]",
          "border-l-4",
          style.border,
          style.opacity,
        )}
      >
        <div
          className={cn(
            "flex h-12 w-20 shrink-0 items-center justify-center rounded bg-gradient-to-br text-[11px] font-semibold text-[var(--admin-ink)]",
            getCoverGradient(event.category, event.type),
          )}
          title={getCategoryLabel(event)}
        >
          {event.startDate
            ? format(new Date(event.startDate), "M/d", { locale: zhCN })
            : getCategoryLabel(event).slice(0, 2)}
        </div>

        <div className="min-w-0 flex-1">
          <Link
            href={`/events/${event.id}`}
            className="text-base font-semibold text-[var(--admin-ink)] hover:text-brand-blue"
          >
            {event.name}
          </Link>
          <p className="mt-1 flex items-center gap-1 text-sm text-text-muted">
            <MapPin className="size-3.5 shrink-0" />
            {formatEventDateRange(
              event.startDate ? new Date(event.startDate) : null,
              event.endDate ? new Date(event.endDate) : null,
            )}
            {event.location ? ` · ${event.location}` : ""}
          </p>

          {phase === "live" && (
            <p className="mt-1 text-sm text-brand-green">
              ● 已签到 {event._count.checkIns}/{event._count.participants}
            </p>
          )}

          {(phase === "upcoming" || phase === "today") && daysUntil != null && daysUntil > 0 && (
            <p className="mt-1 text-sm text-brand-blue">距开始 {daysUntil} 天</p>
          )}

          {phase === "draft" && (
            <div className="mt-2 max-w-xs">
              <div className="mb-1 flex justify-between text-xs text-text-muted">
                <span>准备进度</span>
                <span>
                  {prepProgress.completed}/{prepProgress.total} 项
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-content">
                <div
                  className="h-full rounded-full bg-brand-blue transition-all"
                  style={{
                    width: `${(prepProgress.completed / prepProgress.total) * 100}%`,
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {phase !== "ended" && (
          <div className="hidden shrink-0 text-right sm:block">
            <p className="text-2xl font-bold text-brand-blue">
              {event._count.participants}
            </p>
            <p className="text-xs text-text-muted">报名人数</p>
            <div className="mt-2">
              <EventStatusBadge status={event.status} />
            </div>
          </div>
        )}

        <div className="flex shrink-0 items-center gap-2">
          {phase === "live" && (
            <Link
              href={`/events/${event.id}`}
              className="text-sm font-medium text-brand-blue hover:underline"
            >
              立即进入 →
            </Link>
          )}
          {phase === "ended" && (
            <Link
              href={`/events/${event.id}/reports`}
              className="text-sm text-text-muted hover:underline"
            >
              查看报告 →
            </Link>
          )}
          {(phase === "draft" || phase === "upcoming" || phase === "today") && (
            <Link
              href={`/events/${event.id}`}
              className="hidden text-sm font-medium text-brand-blue hover:underline sm:inline"
            >
              进入 →
            </Link>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex size-8 items-center justify-center rounded-lg text-text-muted hover:bg-content">
              <MoreHorizontal className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => {
                  window.location.href = `/events/${event.id}`;
                }}
              >
                <Pencil className="size-4" />
                进入工作台
              </DropdownMenuItem>
              {phase === "draft" && (
                <>
                  <DropdownMenuItem onClick={() => handlePlaceholder("编辑")}>
                    <Pencil className="size-4" />
                    编辑
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handlePlaceholder("复制")}>
                    <Copy className="size-4" />
                    复制
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handlePlaceholder("归档")}>
                    <Archive className="size-4" />
                    归档
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={() => setDeleteOpen(true)}
                  >
                    <Trash2 className="size-4" />
                    删除
                  </DropdownMenuItem>
                </>
              )}
              {phase !== "draft" && (
                <DropdownMenuItem
                  onClick={() => {
                    window.location.href = `/events/${event.id}/participants`;
                  }}
                >
                  名单管理
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除活动？</AlertDialogTitle>
            <AlertDialogDescription>
              将删除「{event.name}」及其关联数据，此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-brand-red hover:bg-brand-red/90"
              onClick={() => handlePlaceholder("删除")}
            >
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export function EventCardSkeleton() {
  return (
    <div className="h-[96px] animate-pulse rounded-xl border border-border-light border-l-4 border-l-border-light bg-white p-4" />
  );
}
