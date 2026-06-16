"use client";

import { useState } from "react";
import Link from "next/link";
import { differenceInCalendarDays, format } from "date-fns";
import { zhCN } from "date-fns/locale";
import {
  Archive,
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
import { ReviewStatusBadge } from "@/components/admin/status-badge";
import {
  eventCategoryOptions,
  formatEventDateRange,
  getEventPhase,
  type EventPhase,
} from "@/lib/event-utils";
import { cn } from "@/lib/utils";
import type { EventListItem } from "@/hooks/useEvents";
import { useEventsMutationRefetch } from "@/hooks/useEvents";

type EventCardProps = {
  event: EventListItem;
  onEdit?: (event: EventListItem) => void;
};

const phaseStyles: Record<EventPhase, { border: string; opacity?: string }> = {
  live: { border: "border-l-brand-green" },
  today: { border: "border-l-brand-blue" },
  upcoming: { border: "border-l-brand-blue" },
  draft: { border: "border-l-brand-blue" },
  ended: { border: "border-l-border-light", opacity: "opacity-70" },
};

const reviewCardStyles: Record<
  string,
  { border: string; bg?: string; opacity?: string }
> = {
  PENDING_REVIEW: {
    border: "border-l-brand-amber",
    bg: "bg-brand-amber-light/10",
  },
  REVISION_REQUIRED: {
    border: "border-l-brand-red",
    bg: "bg-brand-red-light/10",
  },
  REJECTED: {
    border: "border-l-border-light",
    opacity: "opacity-70",
  },
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

export function EventCard({ event, onEdit }: EventCardProps) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const refetch = useEventsMutationRefetch();

  const reviewStatus = event.reviewStatus ?? event.review?.status ?? "DRAFT";
  const isPendingReview = reviewStatus === "PENDING_REVIEW";
  const isRevisionRequired = reviewStatus === "REVISION_REQUIRED";
  const isRejected = reviewStatus === "REJECTED";

  const phase = getEventPhase({
    status: event.status as "DRAFT" | "PUBLISHED" | "ARCHIVED",
    startDate: event.startDate ? new Date(event.startDate) : null,
    endDate: event.endDate ? new Date(event.endDate) : null,
  });

  const reviewStyle = reviewCardStyles[reviewStatus];
  const phaseStyle = phaseStyles[phase];

  const daysUntil =
    event.startDate && phase !== "live" && phase !== "ended"
      ? differenceInCalendarDays(new Date(event.startDate), new Date())
      : null;

  const prepProgress = event.readiness ?? { completed: 0, total: 9 };

  function handlePlaceholder(action: string) {
    toast.info(`${action}功能将在后续版本开放`);
  }

  async function handleCancelReview() {
    setCanceling(true);
    try {
      const res = await fetch(`/api/events/${event.id}/cancel-review`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "取消失败");
        return;
      }
      toast.success("已取消审核申请");
      await refetch();
    } finally {
      setCanceling(false);
    }
  }

  return (
    <>
      <div
        className={cn(
          "flex items-center gap-4 rounded-xl border border-border-light bg-white p-4 transition-shadow hover:shadow-[0_2px_8px_rgba(26,26,46,0.06)]",
          "border-l-[3px]",
          reviewStyle?.border ?? phaseStyle.border,
          reviewStyle?.bg,
          reviewStyle?.opacity ?? phaseStyle.opacity,
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
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/events/${event.id}`}
              className="text-base font-semibold text-[var(--admin-ink)] hover:text-brand-blue"
            >
              {event.name}
            </Link>
            {(isPendingReview || isRevisionRequired || isRejected) && (
              <ReviewStatusBadge status={reviewStatus} />
            )}
          </div>

          <p className="mt-1 flex items-center gap-1 text-sm text-text-muted">
            <MapPin className="size-3.5 shrink-0" />
            {formatEventDateRange(
              event.startDate ? new Date(event.startDate) : null,
              event.endDate ? new Date(event.endDate) : null,
            )}
            {event.location ? ` · ${event.location}` : ""}
          </p>

          {isPendingReview && (
            <p className="mt-1 text-xs text-text-muted">
              已提交审核，等待平台审核（1-3 个工作日）
            </p>
          )}

          {isRevisionRequired && event.review?.revisionNotes && (
            <p className="mt-1 text-xs text-brand-red">
              {event.review.revisionNotes}
            </p>
          )}

          {isRejected && event.review?.rejectionReason && (
            <p className="mt-1 text-xs text-text-muted">
              {event.review.rejectionReason}
            </p>
          )}

          {phase === "live" && !isPendingReview && (
            <p className="mt-1 text-sm text-brand-green">
              ● 已签到 {event._count.checkIns}/{event._count.participants}
            </p>
          )}

          {(phase === "upcoming" || phase === "today") &&
            daysUntil != null &&
            daysUntil > 0 &&
            !isPendingReview && (
              <p className="mt-1 text-sm text-brand-blue">距开始 {daysUntil} 天</p>
            )}

          {phase === "draft" && !isPendingReview && !isRevisionRequired && !isRejected && (
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

        {phase !== "ended" && !isPendingReview && !isRevisionRequired && !isRejected && (
          <div className="hidden shrink-0 text-right sm:block">
            <p className="text-2xl font-bold text-brand-blue">
              {event._count.participants}
            </p>
            <p className="text-xs text-text-muted">报名人数</p>
          </div>
        )}

        <div className="flex shrink-0 flex-col items-end gap-2">
          {isRevisionRequired && onEdit && (
            <button
              type="button"
              className="rounded-lg bg-brand-blue px-3 py-1.5 text-sm text-white hover:bg-brand-blue/90"
              onClick={() => onEdit(event)}
            >
              修改并重新提交
            </button>
          )}

          {isRejected && onEdit && (
            <button
              type="button"
              className="text-xs text-brand-blue hover:underline"
              onClick={() => onEdit(event)}
            >
              查看原因 / 修改后重新申请
            </button>
          )}

          {isPendingReview && (
            <button
              type="button"
              className="text-xs text-brand-red hover:underline disabled:opacity-50"
              disabled={canceling}
              onClick={() => void handleCancelReview()}
            >
              {canceling ? "取消中..." : "取消审核申请"}
            </button>
          )}

          <div className="flex items-center gap-2">
            {phase === "live" && !isPendingReview && (
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
            {(phase === "draft" || phase === "upcoming" || phase === "today") &&
              !isPendingReview &&
              !isRevisionRequired && (
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
                {phase === "draft" && !isPendingReview && (
                  <>
                    <DropdownMenuItem
                      disabled={isPendingReview}
                      onClick={() => onEdit?.(event)}
                    >
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
    <div className="h-[96px] animate-pulse rounded-xl border border-border-light border-l-[3px] border-l-border-light bg-white p-4" />
  );
}
