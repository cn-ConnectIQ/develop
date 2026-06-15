"use client";

import { useState } from "react";
import {
  Bell,
  CheckSquare,
  Cloud,
  Gift,
  MessageSquare,
  Monitor,
  Pause,
  Square,
  Star,
  ToggleLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  countInteractionStats,
  getInteractionResponseCount,
  INTERACTION_TYPE_SHORT,
  isLotteryClosed,
  isLotteryDraft,
  isLotteryLive,
  isPollClosed,
  isPollDraft,
  isPollLive,
  type InteractionItem,
} from "@/lib/interaction-manager";
import {
  InteractionTypePopover,
  type InteractionCreateType,
} from "@/components/interactions/InteractionTypePopover";

const POLL_ICONS: Record<string, typeof ToggleLeft> = {
  SINGLE_CHOICE: ToggleLeft,
  MULTI_CHOICE: CheckSquare,
  WORD_CLOUD: Cloud,
  RATING: Star,
  QNA: MessageSquare,
  ANNOUNCEMENT: Bell,
};

type InteractionSidebarProps = {
  items: InteractionItem[];
  selectedId: string | null;
  eventId: string;
  onSelect: (item: InteractionItem) => void;
  onCreate: (type: InteractionCreateType) => void;
  onPause: (item: InteractionItem) => void;
  onStop: (item: InteractionItem) => void;
  creating?: boolean;
};

export function InteractionSidebar({
  items,
  selectedId,
  eventId,
  onSelect,
  onCreate,
  onPause,
  onStop,
  creating,
}: InteractionSidebarProps) {
  const stats = countInteractionStats(items);
  const [popoverOpen, setPopoverOpen] = useState(false);

  return (
    <aside className="flex w-[340px] shrink-0 flex-col border-r border-border-light bg-white">
      <div className="border-b border-border-light p-3">
        <InteractionTypePopover
          open={popoverOpen}
          onOpenChange={setPopoverOpen}
          onSelect={onCreate}
        >
          <button
            type="button"
            disabled={creating}
            className="flex h-9 w-full items-center justify-center rounded-lg bg-brand-blue text-sm text-white transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            + 创建互动
          </button>
        </InteractionTypePopover>
        <div className="mt-2 flex gap-2">
          <span className="rounded-md bg-content-bg px-2 py-1 text-xs text-text-muted">
            {stats.total} 个互动
          </span>
          <span className="rounded-md bg-brand-amber-light px-2 py-1 text-xs text-brand-amber">
            {stats.live} 进行中
          </span>
          <span className="rounded-md bg-content-bg px-2 py-1 text-xs text-text-muted">
            {stats.draft} 草稿
          </span>
        </div>
      </div>

      <div className="flex-1 space-y-1 overflow-y-auto p-2">
        {items.map((item) => (
          <InteractionCard
            key={`${item.kind}-${item.id}`}
            item={item}
            eventId={eventId}
            selected={selectedId === item.id}
            onSelect={() => onSelect(item)}
            onPause={() => onPause(item)}
            onStop={() => onStop(item)}
          />
        ))}
      </div>
    </aside>
  );
}

function InteractionCard({
  item,
  eventId,
  selected,
  onSelect,
  onPause,
  onStop,
}: {
  item: InteractionItem;
  eventId: string;
  selected: boolean;
  onSelect: () => void;
  onPause: () => void;
  onStop: () => void;
}) {
  const live =
    item.kind === "poll" ? isPollLive(item.status) : isLotteryLive(item.status);
  const draft =
    item.kind === "poll" ? isPollDraft(item.status) : isLotteryDraft(item.status);
  const closed =
    item.kind === "poll" ? isPollClosed(item.status) : isLotteryClosed(item.status);

  const typeLabel =
    item.kind === "poll"
      ? INTERACTION_TYPE_SHORT[item.type] ?? item.type
      : "抽奖";

  const Icon =
    item.kind === "lottery"
      ? Gift
      : (POLL_ICONS[item.type] ?? ToggleLeft);

  const count = getInteractionResponseCount(item);

  if (live) {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={onSelect}
        onKeyDown={(e) => e.key === "Enter" && onSelect()}
        className="group relative h-[68px] cursor-pointer rounded-xl border border-brand-amber bg-brand-amber-light/20 p-3"
      >
        <div className="absolute bottom-0 left-0 top-0 w-1 rounded-l-xl bg-brand-amber" />
        <div className="pl-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Icon className="size-3.5 text-text-muted" />
              <span className="ml-1 text-xs text-text-muted">{typeLabel}</span>
            </div>
            <span className="flex items-center gap-1 text-[10px] text-brand-amber">
              <span className="size-1.5 animate-pulse rounded-full bg-brand-amber" />
              进行中
            </span>
          </div>
          <p className="mt-0.5 truncate text-[13px] font-semibold">{item.title}</p>
          <div className="mt-1 flex items-center justify-between">
            <span className="text-xs text-text-muted">{count} 人参与</span>
            <div className="hidden items-center gap-2 group-hover:flex">
              <Pause
                className="size-3.5 cursor-pointer text-text-muted hover:text-brand-amber"
                onClick={(e) => {
                  e.stopPropagation();
                  onPause();
                }}
              />
              <Square
                className="size-3.5 cursor-pointer text-text-muted hover:text-brand-red"
                onClick={(e) => {
                  e.stopPropagation();
                  onStop();
                }}
              />
              <Monitor
                className="size-3.5 cursor-pointer text-text-muted hover:text-brand-blue"
                onClick={(e) => {
                  e.stopPropagation();
                  window.open(`/events/${eventId}/interactions/bigscreen`, "_blank");
                }}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => e.key === "Enter" && onSelect()}
      className={cn(
        "group relative h-[68px] cursor-pointer rounded-xl border p-3 transition-colors",
        closed && "opacity-60 hover:opacity-80",
        selected
          ? "border-brand-blue bg-brand-blue-light/10"
          : "border-border-light bg-white hover:border-brand-blue/30 hover:bg-content-bg",
      )}
    >
      {selected && (
        <div className="absolute bottom-0 left-0 top-0 w-[3px] rounded-l-xl bg-brand-blue" />
      )}
      <div className={cn(selected && "pl-1")}>
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <Icon className="size-3.5 text-text-muted" />
            <span className="ml-1 text-xs text-text-muted">{typeLabel}</span>
          </div>
          {closed ? (
            <span className="text-xs text-brand-blue">查看结果 →</span>
          ) : draft ? (
            <span className="text-[10px] text-text-muted">草稿</span>
          ) : null}
        </div>
        <p className="mt-0.5 truncate text-[13px] font-semibold">{item.title}</p>
        {!closed && (
          <p className="mt-1 text-xs text-text-muted">{count} 人参与</p>
        )}
      </div>
    </div>
  );
}
