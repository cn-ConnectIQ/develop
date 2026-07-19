"use client";

import { useMemo, useState } from "react";
import {
  Bell,
  CheckSquare,
  Cloud,
  Gift,
  MessageSquare,
  Monitor,
  Pause,
  Pencil,
  Play,
  Square,
  Star,
  ToggleLeft,
} from "lucide-react";
import {
  FilterTabs,
  ListEmptyState,
  ListIconAction,
  ListPanel,
  ListPanelBody,
  ListPanelHeader,
  SelectableListItem,
} from "@/components/admin/list-panel";
import {
  InteractionTypePopover,
  type InteractionCreateType,
} from "@/components/interactions/InteractionTypePopover";
import { POLL_TYPE_BADGE } from "@/lib/interactions";
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
  isPollPaused,
  type InteractionItem,
} from "@/lib/interaction-manager";
import { withPublicPath } from "@/lib/public-path";

const POLL_ICONS: Record<string, typeof ToggleLeft> = {
  SINGLE_CHOICE: ToggleLeft,
  MULTI_CHOICE: CheckSquare,
  WORD_CLOUD: Cloud,
  RATING: Star,
  QNA: MessageSquare,
  ANNOUNCEMENT: Bell,
};

type FilterTab = "all" | "live" | "draft";

type InteractionSidebarProps = {
  items: InteractionItem[];
  selectedId: string | null;
  eventId: string;
  onSelect: (item: InteractionItem) => void;
  onCreate: (type: InteractionCreateType) => void;
  onPause: (item: InteractionItem) => void;
  onStop: (item: InteractionItem) => void;
  onResume?: (item: InteractionItem) => void;
  creating?: boolean;
};

function itemFilterTab(item: InteractionItem): FilterTab {
  const live =
    item.kind === "poll" ? isPollLive(item.status) : isLotteryLive(item.status);
  const draftOrPaused =
    item.kind === "poll"
      ? isPollDraft(item.status) || isPollPaused(item.status)
      : isLotteryDraft(item.status);
  if (live) return "live";
  if (draftOrPaused) return "draft";
  return "all";
}

export function InteractionSidebar({
  items,
  selectedId,
  eventId,
  onSelect,
  onCreate,
  onPause,
  onStop,
  onResume,
  creating,
}: InteractionSidebarProps) {
  const stats = countInteractionStats(items);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [filter, setFilter] = useState<FilterTab>("all");

  const filteredItems = useMemo(() => {
    if (filter === "all") return items;
    return items.filter((item) => itemFilterTab(item) === filter);
  }, [items, filter]);

  const tabs = [
    { key: "all" as const, label: "全部", count: stats.total },
    { key: "live" as const, label: "进行中", count: stats.live },
    { key: "draft" as const, label: "待发布", count: stats.draft },
  ];

  return (
    <ListPanel>
      <ListPanelHeader>
        <InteractionTypePopover
          open={popoverOpen}
          onOpenChange={setPopoverOpen}
          onSelect={onCreate}
        >
          <button
            type="button"
            disabled={creating}
            className="flex h-9 w-full items-center justify-center rounded-lg bg-brand-blue text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            + 创建互动
          </button>
        </InteractionTypePopover>

        <FilterTabs
          className="mt-3"
          tabs={tabs}
          value={filter}
          onChange={setFilter}
          aria-label="互动筛选"
        />
      </ListPanelHeader>

      <ListPanelBody>
        {filteredItems.length === 0 ? (
          <ListEmptyState>
            {filter === "live"
              ? "暂无进行中的互动"
              : filter === "draft"
                ? "暂无待发布的互动"
                : "暂无互动，点击上方创建"}
          </ListEmptyState>
        ) : (
          <ul className="space-y-1.5">
            {filteredItems.map((item) => (
              <li key={`${item.kind}-${item.id}`}>
                <InteractionListItem
                  item={item}
                  eventId={eventId}
                  selected={selectedId === item.id}
                  onSelect={() => onSelect(item)}
                  onPause={() => onPause(item)}
                  onStop={() => onStop(item)}
                  onResume={() => onResume?.(item)}
                />
              </li>
            ))}
          </ul>
        )}
      </ListPanelBody>
    </ListPanel>
  );
}

function InteractionListItem({
  item,
  eventId,
  selected,
  onSelect,
  onPause,
  onStop,
  onResume,
}: {
  item: InteractionItem;
  eventId: string;
  selected: boolean;
  onSelect: () => void;
  onPause: () => void;
  onStop: () => void;
  onResume: () => void;
}) {
  const live =
    item.kind === "poll" ? isPollLive(item.status) : isLotteryLive(item.status);
  const paused = item.kind === "poll" && isPollPaused(item.status);
  const draft =
    item.kind === "poll" ? isPollDraft(item.status) : isLotteryDraft(item.status);
  const closed =
    item.kind === "poll" ? isPollClosed(item.status) : isLotteryClosed(item.status);

  const typeLabel =
    item.kind === "poll"
      ? INTERACTION_TYPE_SHORT[item.type] ?? item.type
      : "抽奖";

  const Icon =
    item.kind === "lottery" ? Gift : (POLL_ICONS[item.type] ?? ToggleLeft);

  const iconTone =
    item.kind === "lottery"
      ? "bg-violet-50 text-violet-600"
      : (POLL_TYPE_BADGE[item.type] ?? "bg-gray-100 text-text-muted");

  const count = getInteractionResponseCount(item);

  const statusLabel = live
    ? "进行中"
    : paused
      ? "已暂停"
      : draft
        ? "草稿"
        : closed
          ? "已结束"
          : undefined;
  const statusVariant = live
    ? "live"
    : paused
      ? "draft"
      : draft
        ? "draft"
        : closed
          ? "ended"
          : "default";

  return (
    <SelectableListItem
      selected={selected}
      faded={closed}
      icon={Icon}
      iconClassName={iconTone}
      typeLabel={typeLabel}
      title={item.title}
      meta={`${count} 人参与`}
      statusLabel={statusLabel}
      statusVariant={statusVariant}
      onClick={onSelect}
      actions={
        live ? (
          <>
            <ListIconAction
              title="暂停"
              className="hover:text-brand-amber"
              onClick={() => onPause()}
            >
              <Pause className="size-3.5" />
            </ListIconAction>
            <ListIconAction
              title="结束"
              className="hover:text-brand-red"
              onClick={() => onStop()}
            >
              <Square className="size-3.5" />
            </ListIconAction>
            <ListIconAction
              title="投票大屏"
              className="hover:text-brand-blue"
              onClick={() => {
                const pollParam =
                  item.kind === "poll" ? `?poll=${item.id}` : "";
                window.open(
                  withPublicPath(
                    `/events/${eventId}/screen/poll-display${pollParam}`,
                  ),
                  "_blank",
                );
              }}
            >
              <Monitor className="size-3.5" />
            </ListIconAction>
          </>
        ) : paused ? (
          <>
            <ListIconAction
              title="编辑"
              className="hover:text-brand-blue"
              onClick={() => onSelect()}
            >
              <Pencil className="size-3.5" />
            </ListIconAction>
            <ListIconAction
              title="继续发布"
              className="hover:text-brand-green"
              onClick={() => onResume()}
            >
              <Play className="size-3.5" />
            </ListIconAction>
            <ListIconAction
              title="结束"
              className="hover:text-brand-red"
              onClick={() => onStop()}
            >
              <Square className="size-3.5" />
            </ListIconAction>
          </>
        ) : undefined
      }
    />
  );
}
