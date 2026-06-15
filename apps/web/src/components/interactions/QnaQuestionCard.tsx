"use client";

import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import {
  CheckCircle,
  EyeOff,
  Heart,
  Monitor,
  MoreHorizontal,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { QnaResponseItem } from "@/lib/qna-service";

export type QnaAction =
  | "on_screen"
  | "off_screen"
  | "answered"
  | "hidden"
  | "pin"
  | "delete";

type QnaQuestionCardProps = {
  response: QnaResponseItem;
  selected?: boolean;
  onSelect: () => void;
  onAction: (action: QnaAction) => void;
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

export function QnaQuestionCard({
  response,
  selected,
  onSelect,
  onAction,
}: QnaQuestionCardProps) {
  const isOnScreen = response.isOnScreen;
  const isAnswered = response.isAnswered;
  const isHidden = response.isHidden;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => e.key === "Enter" && onSelect()}
      className={cn(
        "group relative cursor-pointer rounded-xl border border-border-light bg-white p-4",
        isOnScreen && "border-brand-blue/30 bg-brand-blue-light/20",
        isAnswered && !isOnScreen && "opacity-50",
        isHidden && "bg-gray-50 opacity-40",
        selected && "ring-2 ring-brand-blue/30",
      )}
    >
      {isOnScreen && (
        <div className="absolute bottom-0 left-0 top-0 w-[3px] rounded-l-xl bg-brand-blue" />
      )}

      {isOnScreen && (
        <span className="absolute right-3 top-3 rounded-sm bg-brand-blue px-1.5 py-0.5 text-[10px] text-white">
          ● 大屏显示中
        </span>
      )}
      {!isOnScreen && isAnswered && (
        <span className="absolute right-3 top-3 rounded-sm bg-brand-green-light px-1.5 py-0.5 text-[10px] text-brand-green">
          ✓ 已回答
        </span>
      )}
      {!isOnScreen && !isAnswered && isHidden && (
        <span className="absolute right-3 top-3 rounded-sm bg-gray-100 px-1.5 py-0.5 text-[10px] text-text-muted">
          已隐藏
        </span>
      )}

      <div className="flex items-center justify-between gap-2 pr-16">
        <div className="flex min-w-0 items-center gap-2">
          {response.participant ? (
            <>
              <Avatar size="sm" className="size-6">
                <AvatarFallback className="text-[10px]">
                  {initials(response.participant.name)}
                </AvatarFallback>
              </Avatar>
              <span className="truncate text-xs font-medium">
                {response.participant.name}
              </span>
              <span className="text-xs text-text-muted">
                {formatTime(response.createdAt)}
              </span>
            </>
          ) : (
            <span className="text-xs text-text-muted">匿名用户</span>
          )}
        </div>
      </div>

      <p className="mt-2 line-clamp-3 text-[14px] leading-snug">
        {response.textAnswer}
      </p>

      <div className="mt-3 flex items-center justify-between">
        <span className="flex items-center gap-1 text-sm text-text-muted">
          <Heart className="size-3" />
          {response.upvoteCount}
        </span>

        <div className="hidden items-center gap-1 group-hover:flex">
          {!isOnScreen && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onAction("on_screen");
              }}
              className="flex h-7 items-center gap-1 rounded-md border border-brand-blue px-2 text-xs text-brand-blue"
            >
              <Monitor className="size-3" />
              上屏
            </button>
          )}
          {!isAnswered && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onAction("answered");
              }}
              className="flex h-7 items-center gap-1 rounded-md border border-brand-green px-2 text-xs text-brand-green"
            >
              <CheckCircle className="size-3" />
              已回答
            </button>
          )}
          {!isHidden && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onAction("hidden");
              }}
              className="flex h-7 items-center gap-1 rounded-md border border-border-light px-2 text-xs text-text-muted"
            >
              <EyeOff className="size-3" />
              隐藏
            </button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger
              className="inline-flex size-7 items-center justify-center rounded-md border border-border-light"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="size-3.5 text-text-muted" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onAction("pin")}>
                置顶
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onAction("pin")}>
                添加标签
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-brand-red"
                onClick={() => onAction("delete")}
              >
                删除
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}
