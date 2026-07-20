"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { EventStatusBadge, formatDateTime } from "@/components/admin/status-badge";
import { SectionCard } from "@/components/admin/admin-header";
import { Button } from "@/components/ui/button";
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
  eventPhaseLabels,
  getEventPhase,
  type EventPhase,
} from "@/lib/event-utils";

type EventStatusValue = "DRAFT" | "PUBLISHED" | "LIVE" | "ARCHIVED";

type EventStatusDetail = {
  id: string;
  name: string;
  status: EventStatusValue;
  reviewStatus: string;
  startDate: string | null;
  endDate: string | null;
  review?: { status: string } | null;
};

async function fetchEvent(eventId: string): Promise<EventStatusDetail> {
  const res = await fetch(`/api/events/${eventId}`);
  if (!res.ok) throw new Error("加载失败");
  return (await res.json()).data as EventStatusDetail;
}

type ConfirmAction =
  | "publish"
  | "go-live"
  | "end-live"
  | "archive"
  | "unarchive"
  | null;

const ACTION_COPY: Record<
  Exclude<ConfirmAction, null>,
  { title: string; description: string; confirm: string; success: string }
> = {
  publish: {
    title: "确认发布活动？",
    description: "发布后参会者可发现并报名本活动。请确认基本信息与票务已配置完整。",
    confirm: "确认发布",
    success: "活动已发布",
  },
  "go-live": {
    title: "设为进行中？",
    description:
      "将活动标记为现场进行中，有利于发现页排序与现场运营入口。可随时改回「已发布」或归档。",
    confirm: "设为进行中",
    success: "活动已设为进行中",
  },
  "end-live": {
    title: "结束现场状态？",
    description: "活动将回到「已发布」，不会归档，仍可被发现与报名。",
    confirm: "结束现场",
    success: "已结束现场状态",
  },
  archive: {
    title: "确认归档活动？",
    description: "归档后活动不再对外展示为可报名状态，可稍后恢复发布。",
    confirm: "确认归档",
    success: "活动已归档",
  },
  unarchive: {
    title: "恢复为已发布？",
    description: "活动将重新对外可见，状态变为「已发布」。",
    confirm: "恢复发布",
    success: "活动已恢复发布",
  },
};

export function EventStatusSettingsPanel({ eventId }: { eventId: string }) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["event-detail", eventId],
    queryFn: () => fetchEvent(eventId),
  });
  const [pending, setPending] = useState<ConfirmAction>(null);
  const [busy, setBusy] = useState(false);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["event-detail", eventId] });
    void queryClient.invalidateQueries({ queryKey: ["event-dashboard", eventId] });
    void queryClient.invalidateQueries({ queryKey: ["events"] });
  };

  const runAction = async (action: Exclude<ConfirmAction, null>) => {
    setBusy(true);
    try {
      const path =
        action === "publish"
          ? `/api/events/${eventId}/publish`
          : `/api/events/${eventId}/${action}`;
      const res = await fetch(path, { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json.error ?? "操作失败");
        return;
      }
      toast.success(ACTION_COPY[action].success);
      setPending(null);
      invalidate();
    } finally {
      setBusy(false);
    }
  };

  if (isLoading || !data) {
    return (
      <SectionCard title="发布与状态">
        <p className="text-sm text-text-muted">加载中…</p>
      </SectionCard>
    );
  }

  const phase: EventPhase = getEventPhase({
    status: data.status,
    startDate: data.startDate ? new Date(data.startDate) : null,
    endDate: data.endDate ? new Date(data.endDate) : null,
  });

  const isPendingReview = data.review?.status === "PENDING_REVIEW";
  const status = data.status;

  return (
    <>
      <SectionCard
        title="发布与状态"
        description="管理活动生命周期：草稿 → 已发布 → 进行中 → 归档。"
      >
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm text-text-muted">活动状态</span>
              <EventStatusBadge status={status} />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-text-muted">运营阶段</span>
              <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-text">
                {eventPhaseLabels[phase]}
              </span>
            </div>
          </div>
          <p className="text-xs text-text-muted">
            活动状态为唯一对外状态（小程序/发现页/现场入口共用）；发布与设为进行中会同步更新镜像字段。
          </p>

          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-text-muted">开始时间</dt>
              <dd className="mt-0.5 font-medium text-text">
                {formatDateTime(data.startDate)}
              </dd>
            </div>
            <div>
              <dt className="text-text-muted">结束时间</dt>
              <dd className="mt-0.5 font-medium text-text">
                {formatDateTime(data.endDate)}
              </dd>
            </div>
          </dl>

          {isPendingReview && (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              活动正在平台审核中，暂不可变更发布状态。
            </p>
          )}

          <div className="flex flex-wrap gap-2 border-t border-border pt-4">
            {status === "DRAFT" && (
              <Button
                disabled={isPendingReview || busy}
                onClick={() => setPending("publish")}
              >
                发布活动
              </Button>
            )}
            {(status === "PUBLISHED" || status === "ARCHIVED") && (
              <Button
                disabled={isPendingReview || busy}
                onClick={() => setPending("go-live")}
              >
                设为进行中
              </Button>
            )}
            {status === "LIVE" && (
              <Button
                variant="outline"
                disabled={isPendingReview || busy}
                onClick={() => setPending("end-live")}
              >
                结束现场（回已发布）
              </Button>
            )}
            {(status === "PUBLISHED" || status === "LIVE") && (
              <Button
                variant="outline"
                disabled={isPendingReview || busy}
                onClick={() => setPending("archive")}
              >
                归档活动
              </Button>
            )}
            {status === "ARCHIVED" && (
              <Button
                variant="outline"
                disabled={isPendingReview || busy}
                onClick={() => setPending("unarchive")}
              >
                恢复发布
              </Button>
            )}
          </div>

          <p className="text-xs text-text-muted">
            「运营阶段」由活动时间自动推算；「活动状态」需手动设置。「进行中」会影响发现页排序与现场入口。
          </p>
        </div>
      </SectionCard>

      <AlertDialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open && !busy) setPending(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pending ? ACTION_COPY[pending].title : ""}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pending ? ACTION_COPY[pending].description : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>取消</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy || !pending}
              onClick={(e) => {
                e.preventDefault();
                if (pending) void runAction(pending);
              }}
            >
              {busy ? "处理中…" : pending ? ACTION_COPY[pending].confirm : "确认"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
