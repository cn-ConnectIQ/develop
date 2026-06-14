"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  BarChart3,
  CheckCircle,
  CheckSquare,
  Cloud,
  ExternalLink,
  Megaphone,
  MessageSquare,
  Pencil,
  Plus,
  Star,
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
import { Button } from "@/components/ui/button";
import { AdminContent } from "@/components/admin/admin-header";
import { CreatePollSheet } from "@/components/interactions/CreatePollSheet";
import { PollResultCard } from "@/components/interactions/PollResultCard";
import type { PollListItem, SessionOption } from "@/lib/interactions";
import {
  estimatePollMinutes,
  formatRemainingMinutes,
  POLL_TYPE_BADGE,
  POLL_TYPE_LABELS,
} from "@/lib/interactions";
import { cn } from "@/lib/utils";

const typeIcons: Record<string, typeof CheckCircle> = {
  SINGLE_CHOICE: CheckCircle,
  MULTI_CHOICE: CheckSquare,
  WORD_CLOUD: Cloud,
  RATING: Star,
  QNA: MessageSquare,
  ANNOUNCEMENT: Megaphone,
};

type PollsResponse = {
  polls: PollListItem[];
  sessions: SessionOption[];
};

async function fetchPolls(eventId: string) {
  const res = await fetch(`/api/events/${eventId}/polls`);
  if (!res.ok) throw new Error("加载失败");
  const json = await res.json();
  const data = json.data as PollsResponse | PollListItem[];
  if (Array.isArray(data)) return { polls: data, sessions: [] };
  return data;
}

async function fetchResults(eventId: string, pollId: string) {
  const res = await fetch(`/api/events/${eventId}/polls/${pollId}/responses`);
  if (!res.ok) return null;
  return (await res.json()).data;
}

export function InteractionsPageClient({ eventId }: { eventId: string }) {
  const [createOpen, setCreateOpen] = useState(false);
  const [editPoll, setEditPoll] = useState<PollListItem | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [viewResultsId, setViewResultsId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["polls", eventId],
    queryFn: () => fetchPolls(eventId),
  });

  const polls = data?.polls ?? [];
  const sessions = data?.sessions ?? [];

  const { data: resultData } = useQuery({
    queryKey: ["poll-results", eventId, viewResultsId],
    queryFn: () => fetchResults(eventId, viewResultsId!),
    enabled: !!viewResultsId,
  });

  const livePoll = polls.find((p) => p.status === "LIVE");
  const draftPolls = polls.filter(
    (p) => p.status === "DRAFT" || p.status === "PAUSED",
  );
  const endedPolls = polls.filter((p) => p.status === "CLOSED");

  const updateStatus = useMutation({
    mutationFn: async ({
      pollId,
      status,
    }: {
      pollId: string;
      status: string;
    }) => {
      const res = await fetch(`/api/events/${eventId}/polls/${pollId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("操作失败");
    },
    onSuccess: () => {
      toast.success("已更新");
      void queryClient.invalidateQueries({ queryKey: ["polls", eventId] });
    },
    onError: () => toast.error("操作失败"),
  });

  const deletePoll = useMutation({
    mutationFn: async (pollId: string) => {
      const res = await fetch(`/api/events/${eventId}/polls/${pollId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("删除失败");
    },
    onSuccess: () => {
      toast.success("已删除");
      setDeleteId(null);
      void queryClient.invalidateQueries({ queryKey: ["polls", eventId] });
    },
    onError: () => toast.error("删除失败"),
  });

  const quickCreate = useMutation({
    mutationFn: async (payload: {
      title: string;
      type: string;
      status?: string;
    }) => {
      const res = await fetch(`/api/events/${eventId}/polls`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload,
          options: ["开放回答"],
          status: payload.status ?? "DRAFT",
        }),
      });
      if (!res.ok) throw new Error("创建失败");
    },
    onSuccess: () => {
      toast.success("已创建");
      void queryClient.invalidateQueries({ queryKey: ["polls", eventId] });
    },
    onError: () => toast.error("创建失败"),
  });

  function openCreate() {
    setEditPoll(null);
    setCreateOpen(true);
  }

  function openEdit(poll: PollListItem) {
    setEditPoll(poll);
    setCreateOpen(true);
  }

  return (
    <AdminContent>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold">互动管理</h1>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            className="border-brand-blue text-brand-blue"
            onClick={openCreate}
          >
            <Plus className="mr-1 size-4" />
            发起投票
          </Button>
          <Button variant="outline" onClick={openCreate}>
            <Plus className="mr-1 size-4" />
            发起问卷
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              quickCreate.mutate({ title: "现场提问收集", type: "QNA" })
            }
          >
            <Plus className="mr-1 size-4" />
            收集提问
          </Button>
          <Button
            className="bg-brand-blue hover:bg-brand-blue/90"
            onClick={() =>
              quickCreate.mutate({
                title: "活动公告",
                type: "ANNOUNCEMENT",
                status: "LIVE",
              })
            }
          >
            <Plus className="mr-1 size-4" />
            发布公告
          </Button>
        </div>
      </div>

      {livePoll && (
        <div className="mb-6 rounded-xl border border-border-light border-l-[4px] border-l-brand-amber bg-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <span className="rounded-full bg-brand-amber-light px-2.5 py-0.5 text-xs font-medium text-brand-amber">
                投票进行中
              </span>
              <h2 className="mt-2 text-lg font-semibold">{livePoll.title}</h2>
              <p className="mt-1 text-sm text-text-muted">
                {livePoll._count.responses} 人已投票
                {livePoll.closesAt &&
                  ` · ${formatRemainingMinutes(livePoll.closesAt)}`}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="ghost"
                className="text-brand-blue"
                onClick={() => setViewResultsId(livePoll.id)}
              >
                查看实时结果
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  updateStatus.mutate({ pollId: livePoll.id, status: "PAUSED" })
                }
              >
                暂停
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  updateStatus.mutate({ pollId: livePoll.id, status: "CLOSED" })
                }
              >
                结束
              </Button>
              <Link href={`/events/${eventId}/bigscreen`} target="_blank">
                <Button variant="outline" size="sm">
                  <ExternalLink className="mr-1 size-3" />
                  大屏 ↗
                </Button>
              </Link>
            </div>
          </div>
        </div>
      )}

      {viewResultsId && resultData && (
        <div className="mb-6">
          <PollResultCard
            title={resultData.poll.title}
            total={resultData.totalResponses}
            type={resultData.poll.type}
            options={resultData.options}
            wordCloud={resultData.wordCloud}
            averageRating={resultData.averageRating}
          />
          <Button
            variant="ghost"
            size="sm"
            className="mt-2"
            onClick={() => setViewResultsId(null)}
          >
            关闭结果
          </Button>
        </div>
      )}

      {draftPolls.length > 0 && (
        <section className="mb-6">
          <div className="mb-2 rounded-lg bg-blue-50 px-4 py-2 text-xs font-medium text-brand-blue">
            已准备
          </div>
          <div className="space-y-2">
            {draftPolls.map((poll) => (
              <PollListCard
                key={poll.id}
                poll={poll}
                onPublish={() =>
                  updateStatus.mutate({ pollId: poll.id, status: "LIVE" })
                }
                onEdit={() => openEdit(poll)}
                onDelete={() => setDeleteId(poll.id)}
              />
            ))}
          </div>
        </section>
      )}

      {endedPolls.length > 0 && (
        <section>
          <div className="mb-2 rounded-lg bg-gray-100 px-4 py-2 text-xs font-medium text-text-muted">
            已结束
          </div>
          <div className="space-y-2 opacity-90">
            {endedPolls.map((poll) => (
              <PollListCard
                key={poll.id}
                poll={poll}
                ended
                onViewResults={() => setViewResultsId(poll.id)}
              />
            ))}
          </div>
        </section>
      )}

      {!isLoading && polls.length === 0 && (
        <div className="rounded-xl border border-border-light bg-white py-16 text-center">
          <BarChart3 className="mx-auto mb-3 size-10 text-text-tertiary" />
          <p className="text-sm text-text-muted">暂无互动，点击「发起投票」开始</p>
          <Button className="mt-4 bg-brand-blue" onClick={openCreate}>
            发起投票
          </Button>
        </div>
      )}

      <CreatePollSheet
        eventId={eventId}
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) setEditPoll(null);
        }}
        onSuccess={() =>
          void queryClient.invalidateQueries({ queryKey: ["polls", eventId] })
        }
        sessions={sessions}
        editPoll={editPoll}
      />

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除互动</AlertDialogTitle>
            <AlertDialogDescription>
              确定删除此互动吗？相关投票数据将一并删除，且不可恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-brand-red hover:bg-brand-red/90"
              onClick={() => deleteId && deletePoll.mutate(deleteId)}
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminContent>
  );
}

function PollListCard({
  poll,
  ended,
  onPublish,
  onEdit,
  onDelete,
  onViewResults,
}: {
  poll: PollListItem;
  ended?: boolean;
  onPublish?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onViewResults?: () => void;
}) {
  const Icon = typeIcons[poll.type] ?? CheckCircle;
  const badgeClass = POLL_TYPE_BADGE[poll.type] ?? "bg-gray-100 text-text-muted";
  const estMinutes = estimatePollMinutes(poll.type, poll.options.length);

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-4 rounded-xl border border-border-light bg-white p-4",
        ended && "bg-gray-50/80",
      )}
    >
      <div
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-lg",
          badgeClass,
        )}
      >
        <Icon className="size-5" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "rounded px-2 py-0.5 text-[10px] font-medium",
              badgeClass,
            )}
          >
            {POLL_TYPE_LABELS[poll.type] ?? poll.type}
          </span>
          {poll.status === "PAUSED" && (
            <span className="text-[10px] text-brand-amber">已暂停</span>
          )}
        </div>
        <p className="mt-1 font-medium">{poll.title}</p>
        <p className="text-xs text-text-muted">
          {ended ? (
            <>
              {poll._count.responses} 人参与 · 结束于{" "}
              {format(new Date(poll.updatedAt), "MM-dd HH:mm")}
            </>
          ) : (
            <>
              共 {Math.max(poll.options.length, 1)} 题 · 预计 {estMinutes} 分钟
            </>
          )}
        </p>
      </div>

      <div className="flex items-center gap-1">
        {onPublish && (
          <Button
            variant="ghost"
            size="sm"
            className="text-brand-blue"
            onClick={onPublish}
          >
            立即发布
          </Button>
        )}
        {onEdit && (
          <Button variant="ghost" size="icon" onClick={onEdit}>
            <Pencil className="size-4 text-text-tertiary" />
          </Button>
        )}
        {onViewResults && (
          <Button
            variant="ghost"
            size="sm"
            className="text-brand-blue"
            onClick={onViewResults}
          >
            查看结果 →
          </Button>
        )}
        {onDelete && (
          <Button variant="ghost" size="icon" onClick={onDelete}>
            <Trash2 className="size-4 text-text-tertiary" />
          </Button>
        )}
      </div>
    </div>
  );
}
