"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  OpenBigscreenButton,
  PushToAttendeesButton,
} from "@/components/interactions/PushToAttendeesButton";
import { QnaQuestionCard, type QnaAction } from "@/components/interactions/QnaQuestionCard";
import { QnaDetailPanel } from "@/components/interactions/QnaDetailPanel";
import {
  deleteQnaResponse,
  markAllQnaAnswered,
  patchQnaResponse,
  useRealtimeQna,
} from "@/hooks/useRealtimeQna";
import type { QnaResponseItem } from "@/lib/qna-service";
import { cn } from "@/lib/utils";

type SortMode = "popular" | "latest" | "unanswered";

type QnaManagerProps = {
  pollId: string;
  eventId: string;
  pollStatus?: string;
  onStatusChange?: () => void;
};

export function QnaManager({
  pollId,
  eventId,
  pollStatus = "DRAFT",
  onStatusChange,
}: QnaManagerProps) {
  const [sort, setSort] = useState<SortMode>("popular");
  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [collectionEnabled, setCollectionEnabled] = useState(
    pollStatus === "LIVE" || pollStatus === "PAUSED",
  );
  const listRef = useRef<HTMLDivElement>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setCollectionEnabled(pollStatus === "LIVE" || pollStatus === "PAUSED");
  }, [pollStatus, pollId]);

  const {
    data,
    loading,
    newCount,
    clearNewCount,
    refetch,
    updateLocalResponse,
    removeLocalResponse,
  } = useRealtimeQna({ eventId, pollId });

  const handleSearchChange = (value: string) => {
    setSearch(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setSearchDebounced(value), 300);
  };

  const filtered = useMemo(() => {
    let list = data?.responses ?? [];

    if (searchDebounced.trim()) {
      const q = searchDebounced.trim().toLowerCase();
      list = list.filter((r) => r.textAnswer.toLowerCase().includes(q));
    }

    if (sort === "unanswered") {
      list = list.filter((r) => !r.isAnswered && !r.isHidden);
    }

    list = [...list].sort((a, b) => {
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
      if (sort === "latest") {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      if (sort === "unanswered") {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      return b.upvoteCount - a.upvoteCount;
    });

    return list;
  }, [data?.responses, searchDebounced, sort]);

  const selected =
    filtered.find((r) => r.id === selectedId) ??
    data?.responses.find((r) => r.id === selectedId) ??
    null;

  const scrollToTop = useCallback(() => {
    listRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const handleNewQuestionsClick = useCallback(() => {
    scrollToTop();
    clearNewCount();
  }, [scrollToTop, clearNewCount]);

  const runAction = useCallback(
    async (
      response: QnaResponseItem,
      action: QnaAction | "off_screen" | "archive" | "save_note" | "publish_reply",
      payload?: { hostNote?: string; publicReply?: string },
    ) => {
      try {
        switch (action) {
          case "on_screen":
            await patchQnaResponse(eventId, pollId, response.id, {
              is_on_screen: true,
            });
            updateLocalResponse(response.id, {
              isOnScreen: true,
              isHidden: false,
            });
            data?.responses.forEach((r) => {
              if (r.id !== response.id && r.isOnScreen) {
                updateLocalResponse(r.id, { isOnScreen: false });
              }
            });
            toast.success("已上屏");
            break;
          case "off_screen":
            await patchQnaResponse(eventId, pollId, response.id, {
              is_on_screen: false,
            });
            updateLocalResponse(response.id, { isOnScreen: false });
            toast.success("已从大屏移除");
            break;
          case "answered":
            await patchQnaResponse(eventId, pollId, response.id, {
              is_answered: true,
            });
            updateLocalResponse(response.id, { isAnswered: true });
            toast.success("已标记为已回答");
            break;
          case "hidden":
          case "archive":
            await patchQnaResponse(eventId, pollId, response.id, {
              is_hidden: true,
            });
            updateLocalResponse(response.id, { isHidden: true });
            toast.success("已隐藏");
            break;
          case "pin":
            await patchQnaResponse(eventId, pollId, response.id, {
              is_pinned: !response.isPinned,
            });
            updateLocalResponse(response.id, {
              isPinned: !response.isPinned,
            });
            toast.success(response.isPinned ? "已取消置顶" : "已置顶");
            break;
          case "delete":
            await deleteQnaResponse(eventId, pollId, response.id);
            removeLocalResponse(response.id);
            if (selectedId === response.id) setSelectedId(null);
            toast.success("已删除");
            break;
          case "save_note":
            if (payload?.hostNote !== undefined) {
              await patchQnaResponse(eventId, pollId, response.id, {
                host_note: payload.hostNote,
              });
              updateLocalResponse(response.id, {
                hostNote: payload.hostNote,
              });
            }
            break;
          case "publish_reply":
            if (payload?.publicReply !== undefined) {
              await patchQnaResponse(eventId, pollId, response.id, {
                public_reply: payload.publicReply,
              });
              updateLocalResponse(response.id, {
                publicReply: payload.publicReply,
              });
              toast.success("回复已发布");
            }
            break;
        }
        void refetch();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "操作失败");
      }
    },
    [
      eventId,
      pollId,
      data?.responses,
      updateLocalResponse,
      removeLocalResponse,
      selectedId,
      refetch,
    ],
  );

  async function toggleCollection(enabled: boolean) {
    setCollectionEnabled(enabled);
    try {
      const status = enabled ? "LIVE" : "PAUSED";
      const res = await fetch(
        `/api/events/${eventId}/polls/${pollId}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status, push: enabled }),
        },
      );
      if (!res.ok) throw new Error("状态更新失败");
      onStatusChange?.();
      const json = await res.json().catch(() => null);
      const pushResult = json?.data?.pushResult as
        | { sent: number; skipped: number }
        | undefined;
      if (enabled && pushResult) {
        toast.success(
          `已开启收集，推送 ${pushResult.sent} 人${pushResult.skipped > 0 ? `，${pushResult.skipped} 人未绑定账号` : ""}`,
        );
      } else {
        toast.success(enabled ? "已开启收集" : "已暂停收集");
      }
    } catch (e) {
      setCollectionEnabled(!enabled);
      toast.error(e instanceof Error ? e.message : "操作失败");
    }
  }

  async function handleMarkAllAnswered() {
    try {
      await markAllQnaAnswered(eventId, pollId);
      void refetch();
      toast.success("已全部标记为已回答");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "操作失败");
    }
  }

  const sortOptions: Array<{ key: SortMode; label: string }> = [
    { key: "popular", label: "热门" },
    { key: "latest", label: "最新" },
    { key: "unanswered", label: "未回答" },
  ];

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden px-6 py-5">
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-border-light bg-white p-3">
        <span className="text-sm font-semibold text-brand-green">Q&A</span>

        <div className="flex items-center gap-2">
          <Switch
            checked={collectionEnabled}
            onCheckedChange={(v) => void toggleCollection(v)}
            className="data-checked:bg-brand-green"
          />
          <span className="text-xs text-text-muted">开启收集</span>
        </div>

        {newCount > 0 && (
          <button
            type="button"
            onClick={handleNewQuestionsClick}
            className="animate-wiggle rounded-full bg-brand-blue px-3 py-1 text-xs text-white"
          >
            ↑ {newCount} 个新问题
          </button>
        )}

        <div className="flex overflow-hidden rounded-lg border border-border-light">
          {sortOptions.map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => setSort(opt.key)}
              className={cn(
                "cursor-pointer px-3 py-1 text-xs",
                sort === opt.key
                  ? "bg-brand-blue text-white"
                  : "bg-white text-text-muted hover:bg-content-bg",
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="relative ml-auto w-48">
          <Search className="pointer-events-none absolute left-2 top-1/2 size-3 -translate-y-1/2 text-text-muted" />
          <Input
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="搜索问题…"
            className="h-8 pl-7 text-xs"
          />
        </div>

        <button
          type="button"
          onClick={() => void handleMarkAllAnswered()}
          className="ml-2 cursor-pointer text-xs text-text-muted hover:text-brand-green"
        >
          全部标记已回答
        </button>

        <PushToAttendeesButton
          eventId={eventId}
          kind="qna"
          targetId={pollId}
        />
        <OpenBigscreenButton eventId={eventId} />
      </div>

      <div className="flex min-h-0 flex-1 gap-4 overflow-hidden">
        <div ref={listRef} className="min-w-0 flex-1 overflow-y-auto">
          {newCount > 0 && (
            <button
              type="button"
              onClick={handleNewQuestionsClick}
              className="sticky top-0 z-10 mb-3 w-full cursor-pointer rounded-lg bg-brand-blue py-2 text-center text-sm text-white"
            >
              ↑ {newCount} 个新问题，点击查看
            </button>
          )}

          {loading ? (
            <p className="py-8 text-center text-sm text-text-muted">加载中…</p>
          ) : filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-text-muted">
              暂无问题，开启收集后参会者可以提问
            </p>
          ) : (
            <div className="space-y-2">
              {filtered.map((response) => (
                <QnaQuestionCard
                  key={response.id}
                  response={response}
                  selected={selectedId === response.id}
                  onSelect={() => setSelectedId(response.id)}
                  onAction={(action) => void runAction(response, action)}
                />
              ))}
            </div>
          )}
        </div>

        <QnaDetailPanel
          selected={selected}
          onScreenPreview={data?.onScreenResponse ?? null}
          onAction={(action, payload) => {
            if (!selected) return;
            void runAction(selected, action, payload);
          }}
        />
      </div>
    </div>
  );
}
