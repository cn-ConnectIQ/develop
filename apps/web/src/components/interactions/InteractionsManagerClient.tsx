"use client";

import { useCallback, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { Button } from "@/components/ui/button";
import { InteractionSidebar } from "@/components/interactions/InteractionSidebar";
import { InteractionWorkspace } from "@/components/interactions/InteractionWorkspace";
import type { InteractionCreateType } from "@/components/interactions/InteractionTypePopover";
import type { PollListItem, SessionOption } from "@/lib/interactions";
import {
  getDefaultPollOptions,
  getDefaultPollTitle,
  mergeInteractions,
  type InteractionItem,
} from "@/lib/interaction-manager";
import { withPublicPath } from "@/lib/public-path";

async function fetchInteractions(eventId: string) {
  const [pollsRes, announcementsRes] = await Promise.all([
    fetch(withPublicPath(`/api/events/${eventId}/polls`)),
    fetch(withPublicPath(`/api/events/${eventId}/announcements`)),
  ]);

  if (!pollsRes.ok) {
    const json = await pollsRes.json().catch(() => null);
    throw new Error(json?.error ?? "加载投票失败");
  }

  const pollsJson = await pollsRes.json();
  const pollsData = pollsJson.data as
    | { polls: PollListItem[]; sessions: SessionOption[] }
    | PollListItem[];
  const rawPolls = Array.isArray(pollsData) ? pollsData : pollsData.polls;
  const polls = rawPolls
    .filter((poll) => poll.type !== "ANNOUNCEMENT")
    .map((poll) => ({
      ...poll,
      _count: {
        responses:
          poll._count?.responses ??
          (poll as { participant_count?: number }).participant_count ??
          0,
      },
    }));
  const sessions = Array.isArray(pollsData) ? [] : pollsData.sessions;

  let announcements: Array<{
    id: string;
    title: string;
    content: string;
    isPinned?: boolean;
    is_pinned?: boolean;
    publishedAt?: string;
    published_at?: string;
  }> = [];
  if (announcementsRes.ok) {
    const annJson = await announcementsRes.json();
    announcements =
      annJson.data?.announcements ?? annJson.data?.items ?? [];
  }

  return { polls, sessions, announcements };
}

export function InteractionsManagerClient({ eventId }: { eventId: string }) {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<InteractionItem | null>(null);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["interactions", eventId],
    queryFn: () => fetchInteractions(eventId),
  });

  const items = useMemo(
    () => mergeInteractions(data?.polls ?? [], [], data?.announcements ?? []),
    [data],
  );

  const selection = items.find((i) => i.id === selectedId) ?? null;

  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["interactions", eventId] });
  }, [queryClient, eventId]);

  const createMutation = useMutation({
    mutationFn: async (type: InteractionCreateType) => {
      if (type === "ANNOUNCEMENT") {
        const res = await fetch(
          withPublicPath(`/api/events/${eventId}/announcements`),
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title: "现场公告",
              content: "请在此填写公告正文。",
              isPinned: false,
            }),
          },
        );
        if (!res.ok) {
          const json = await res.json().catch(() => null);
          throw new Error(
            typeof json?.error === "string" ? json.error : "创建公告失败",
          );
        }
        return {
          kind: "announcement" as const,
          data: (await res.json()).data as { id: string },
        };
      }

      const res = await fetch(
        withPublicPath(`/api/events/${eventId}/polls`),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: getDefaultPollTitle(type),
            type,
            status: "DRAFT",
            options: getDefaultPollOptions(type),
          }),
        },
      );
      if (!res.ok) throw new Error("创建互动失败");
      return { kind: "poll" as const, data: (await res.json()).data };
    },
    onSuccess: (result) => {
      refresh();
      setSelectedId(result.data.id);
      toast.success(
        result.kind === "announcement" ? "公告已发布，可继续编辑" : "已创建草稿",
      );
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "创建失败"),
  });

  async function updatePollStatus(
    pollId: string,
    status: "LIVE" | "PAUSED" | "CLOSED" | "DRAFT",
    push = false,
  ) {
    const res = await fetch(
      withPublicPath(`/api/events/${eventId}/polls/${pollId}/status`),
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, push: status === "LIVE" ? push : false }),
      },
    );
    if (!res.ok) {
      const json = await res.json().catch(() => null);
      throw new Error(
        typeof json?.error === "string" ? json.error : "状态更新失败",
      );
    }
    const json = await res.json().catch(() => null);
    refresh();
    return json?.data?.pushResult as
      | { sent: number; skipped: number }
      | null
      | undefined;
  }

  async function handleDelete(item: InteractionItem) {
    const path =
      item.kind === "announcement"
        ? `/api/events/${eventId}/announcements/${item.id}`
        : `/api/events/${eventId}/polls/${item.id}`;
    const res = await fetch(withPublicPath(path), { method: "DELETE" });
    if (!res.ok) {
      toast.error("删除失败");
      return;
    }
    if (selectedId === item.id) setSelectedId(null);
    refresh();
    toast.success("已删除");
  }

  function handleActivate(item: InteractionItem) {
    if (item.kind !== "poll") return;
    void (async () => {
      try {
        const pushResult = await updatePollStatus(item.id, "LIVE", true);
        if (pushResult) {
          toast.success(
            `互动已激活，推送 ${pushResult.sent} 人${pushResult.skipped > 0 ? `，${pushResult.skipped} 人未绑定账号` : ""}`,
          );
        } else {
          toast.success("互动已激活");
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "激活失败");
      }
    })();
  }

  function handlePause(item: InteractionItem) {
    if (item.kind !== "poll") return;
    void (async () => {
      try {
        await updatePollStatus(item.id, "PAUSED");
        toast.success("已暂停，可继续编辑后发布");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "暂停失败");
      }
    })();
  }

  function handleStop(item: InteractionItem) {
    if (item.kind !== "poll") return;
    void (async () => {
      try {
        await updatePollStatus(item.id, "CLOSED");
        toast.success("投票已结束");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "操作失败");
      }
    })();
  }

  if (isLoading) {
    return (
      <div className="flex h-[calc(100vh-56px)] items-center justify-center text-sm text-text-muted">
        加载中…
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex h-[calc(100vh-56px)] flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-sm font-medium text-[var(--admin-ink)]">
          互动列表加载失败
        </p>
        <p className="max-w-md text-sm text-text-muted">
          {error instanceof Error ? error.message : "请稍后重试"}
        </p>
        <Button variant="outline" onClick={() => void refetch()}>
          重试
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="flex h-[calc(100vh-56px)] overflow-hidden">
        <InteractionSidebar
          items={items}
          selectedId={selectedId}
          eventId={eventId}
          onSelect={(item) => setSelectedId(item.id)}
          onCreate={(type) => createMutation.mutate(type)}
          onPause={handlePause}
          onStop={handleStop}
          onResume={handleActivate}
          creating={createMutation.isPending}
        />
        <InteractionWorkspace
          eventId={eventId}
          selection={selection}
          sessions={data?.sessions ?? []}
          onRefresh={refresh}
          onDelete={(item) => setDeleteTarget(item)}
          onActivate={handleActivate}
          onPause={handlePause}
          onStop={handleStop}
        />
      </div>

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除「{deleteTarget?.title}」吗？此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-brand-red text-white hover:bg-brand-red/90"
              onClick={() => {
                if (deleteTarget) void handleDelete(deleteTarget);
                setDeleteTarget(null);
              }}
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
