"use client";

import { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import { Heart } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import type { QnaResponseItem } from "@/lib/qna-service";

type QnaDetailPanelProps = {
  selected: QnaResponseItem | null;
  onScreenPreview: QnaResponseItem | null;
  onAction: (
    action:
      | "on_screen"
      | "off_screen"
      | "answered"
      | "archive"
      | "save_note"
      | "publish_reply",
    payload?: { hostNote?: string; publicReply?: string },
  ) => void;
};

function formatTime(iso: string) {
  try {
    return formatDistanceToNow(new Date(iso), {
      addSuffix: true,
      locale: zhCN,
    });
  } catch {
    return "";
  }
}

function initials(name: string) {
  return name.slice(0, 1).toUpperCase();
}

export function QnaDetailPanel({
  selected,
  onScreenPreview,
  onAction,
}: QnaDetailPanelProps) {
  const [hostNote, setHostNote] = useState("");
  const [publicReply, setPublicReply] = useState("");

  useEffect(() => {
    setHostNote(selected?.hostNote ?? "");
    setPublicReply(selected?.publicReply ?? "");
  }, [selected?.id, selected?.hostNote, selected?.publicReply]);

  if (!selected) {
    return (
      <aside className="w-[300px] shrink-0 overflow-y-auto border-l border-border-light px-4 py-4">
        <p className="text-[10px] uppercase tracking-widest text-text-muted">
          大屏预览
        </p>
        <div className="mx-auto mt-4 w-[200px]">
          <div className="aspect-[9/19.5] overflow-hidden rounded-3xl border-4 border-gray-800 bg-white p-4">
            {onScreenPreview ? (
              <div>
                <p className="text-xs text-brand-blue">● 正在展示</p>
                <p className="mt-3 text-sm font-medium leading-relaxed">
                  {onScreenPreview.textAnswer}
                </p>
                {onScreenPreview.participant && (
                  <p className="mt-2 text-xs text-text-muted">
                    — {onScreenPreview.participant.name}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-center text-xs text-text-muted">
                暂无问题上屏
              </p>
            )}
          </div>
        </div>
      </aside>
    );
  }

  return (
    <aside className="w-[300px] shrink-0 overflow-y-auto border-l border-border-light px-4 py-4">
      <p className="text-xs font-medium uppercase text-text-muted">
        问题详情
      </p>

      <p className="mt-3 text-[15px] font-medium leading-relaxed">
        {selected.textAnswer}
      </p>

      <div className="mt-3 flex items-center gap-2">
        {selected.participant ? (
          <>
            <Avatar className="size-8">
              <AvatarFallback className="text-xs">
                {initials(selected.participant.name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">
                {selected.participant.name}
              </p>
              {selected.participant.company && (
                <p className="truncate text-xs text-text-muted">
                  {selected.participant.company}
                </p>
              )}
            </div>
            <span className="ml-auto shrink-0 text-xs text-text-muted">
              {formatTime(selected.createdAt)}
            </span>
          </>
        ) : (
          <span className="text-xs text-text-muted">匿名用户</span>
        )}
      </div>

      <p className="mt-2 flex items-center gap-1 text-sm text-text-muted">
        <Heart className="size-3.5" />
        {selected.upvoteCount} 人点赞
      </p>

      <div className="mt-3">
        <p className="mb-1 text-xs text-text-muted">备注（仅自己可见）</p>
        <Textarea
          value={hostNote}
          onChange={(e) => setHostNote(e.target.value)}
          onBlur={() => onAction("save_note", { hostNote })}
          className="w-full resize-none rounded-lg border border-border-light bg-gray-50 p-2 text-sm"
          rows={3}
        />
      </div>

      <div className="mt-4 space-y-2">
        {!selected.isOnScreen ? (
          <Button
            type="button"
            className="h-10 w-full rounded-lg bg-brand-blue text-sm font-medium text-white"
            onClick={() => onAction("on_screen")}
          >
            ⬆ 上屏展示
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            className="h-10 w-full rounded-lg border-brand-red bg-brand-red-light text-sm text-brand-red"
            onClick={() => onAction("off_screen")}
          >
            ⬇ 从大屏移除
          </Button>
        )}
        {!selected.isAnswered && (
          <Button
            type="button"
            variant="outline"
            className="h-10 w-full rounded-lg border-brand-green bg-brand-green-light text-sm text-brand-green"
            onClick={() => onAction("answered")}
          >
            ✓ 标记已回答
          </Button>
        )}
        <Button
          type="button"
          variant="outline"
          className="h-10 w-full rounded-lg bg-gray-100 text-sm text-text-muted"
          onClick={() => onAction("archive")}
        >
          ↓ 移入归档
        </Button>
      </div>

      <div className="mt-4 border-t border-border-light pt-4">
        <p className="mb-2 text-xs font-medium text-text-muted">主持人回复</p>
        <Textarea
          value={publicReply}
          onChange={(e) => setPublicReply(e.target.value)}
          className="w-full rounded-lg border border-border-light p-2 text-sm"
          rows={3}
          placeholder="输入公开回复…"
        />
        <button
          type="button"
          onClick={() => onAction("publish_reply", { publicReply })}
          className="mt-1 block w-full cursor-pointer text-right text-sm text-brand-blue hover:underline"
        >
          发布回复
        </button>
      </div>
    </aside>
  );
}
