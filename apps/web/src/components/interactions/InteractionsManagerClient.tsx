"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
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
import { InteractionSidebar } from "@/components/interactions/InteractionSidebar";
import { InteractionWorkspace } from "@/components/interactions/InteractionWorkspace";
import type { InteractionCreateType } from "@/components/interactions/InteractionTypePopover";
import type { PollListItem, SessionOption } from "@/lib/interactions";
import {
  getDefaultPollOptions,
  getDefaultPollTitle,
  mergeInteractions,
  type InteractionItem,
  type LotteryListItem,
} from "@/lib/interaction-manager";

async function fetchInteractions(eventId: string) {
  const [pollsRes, lotteriesRes] = await Promise.all([
    fetch(`/api/events/${eventId}/polls`),
    fetch(`/api/events/${eventId}/lotteries`),
  ]);
  if (!pollsRes.ok) throw new Error("加载投票失败");
  const pollsJson = await pollsRes.json();
  const pollsData = pollsJson.data as
    | { polls: PollListItem[]; sessions: SessionOption[] }
    | PollListItem[];
  const polls = Array.isArray(pollsData) ? pollsData : pollsData.polls;
  const sessions = Array.isArray(pollsData) ? [] : pollsData.sessions;

  let lotteries: LotteryListItem[] = [];
  if (lotteriesRes.ok) {
    const lotteriesJson = await lotteriesRes.json();
    lotteries = lotteriesJson.data as LotteryListItem[];
  }

  return { polls, lotteries, sessions };
}

export function InteractionsManagerClient({ eventId }: { eventId: string }) {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const lotteryFromUrl = searchParams.get("lottery");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<InteractionItem | null>(null);

  useEffect(() => {
    if (lotteryFromUrl) {
      setSelectedId(lotteryFromUrl);
    }
  }, [lotteryFromUrl]);

  const { data, isLoading } = useQuery({
    queryKey: ["interactions", eventId],
    queryFn: () => fetchInteractions(eventId),
  });

  const items = useMemo(
    () => mergeInteractions(data?.polls ?? [], data?.lotteries ?? []),
    [data],
  );

  const selection = items.find((i) => i.id === selectedId) ?? null;

  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["interactions", eventId] });
  }, [queryClient, eventId]);

  const createMutation = useMutation({
    mutationFn: async (type: InteractionCreateType) => {
      if (type === "LOTTERY") {
        const res = await fetch(`/api/events/${eventId}/lotteries`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: "未命名抽奖",
            prizes: [{ rank: 1, name: "一等奖", prize: "奖品", count: 1 }],
          }),
        });
        if (!res.ok) throw new Error("创建抽奖失败");
        return { kind: "lottery" as const, data: (await res.json()).data };
      }

      const pollType =
        type === "SURVEY"
          ? "MULTI_CHOICE"
          : type === "QUIZ"
            ? "SINGLE_CHOICE"
            : type;

      const res = await fetch(`/api/events/${eventId}/polls`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: getDefaultPollTitle(pollType),
          type: pollType,
          status: "DRAFT",
          options: getDefaultPollOptions(pollType),
        }),
      });
      if (!res.ok) throw new Error("创建互动失败");
      return { kind: "poll" as const, data: (await res.json()).data };
    },
    onSuccess: (result) => {
      refresh();
      setSelectedId(result.data.id);
      toast.success("已创建草稿");
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "创建失败"),
  });

  async function updatePollStatus(
    pollId: string,
    status: "LIVE" | "PAUSED" | "CLOSED" | "DRAFT",
  ) {
    const res = await fetch(
      `/api/events/${eventId}/polls/${pollId}/status`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      },
    );
    if (!res.ok) throw new Error("状态更新失败");
    refresh();
  }

  async function updateLotteryStatus(
    lotteryId: string,
    status: string,
  ) {
    const res = await fetch(
      `/api/events/${eventId}/lotteries/${lotteryId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      },
    );
    if (!res.ok) throw new Error("状态更新失败");
    refresh();
  }

  async function handleDelete(item: InteractionItem) {
    if (item.kind === "lottery") {
      toast.error("抽奖暂不支持删除，请先结束抽奖");
      return;
    }
    const res = await fetch(`/api/events/${eventId}/polls/${item.id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      toast.error("删除失败");
      return;
    }
    if (selectedId === item.id) setSelectedId(null);
    refresh();
    toast.success("已删除");
  }

  function handleActivate(item: InteractionItem) {
    void (async () => {
      try {
        if (item.kind === "poll") {
          await updatePollStatus(item.id, "LIVE");
          toast.success("互动已激活");
        } else {
          await updateLotteryStatus(item.id, "OPEN");
          toast.success("抽奖已开放");
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "激活失败");
      }
    })();
  }

  function handlePause(item: InteractionItem) {
    void (async () => {
      try {
        if (item.kind === "poll") {
          await updatePollStatus(item.id, "PAUSED");
        } else {
          await updateLotteryStatus(item.id, "READY");
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "操作失败");
      }
    })();
  }

  function handleStop(item: InteractionItem) {
    void (async () => {
      try {
        if (item.kind === "poll") {
          await updatePollStatus(item.id, "CLOSED");
        } else {
          await updateLotteryStatus(item.id, "FINISHED");
        }
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
