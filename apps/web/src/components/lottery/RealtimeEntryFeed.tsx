"use client";

import type { LotteryDashboardEntry } from "@/lib/lottery/lottery-dashboard-service";
import { cn } from "@/lib/utils";

const INTENT_STYLES = {
  A: "bg-brand-green text-white",
  B: "bg-brand-amber text-white",
  C: "bg-gray-200 text-text-muted",
} as const;

type RealtimeEntryFeedProps = {
  entries: LotteryDashboardEntry[];
  highlightId?: string | null;
};

function EntryRow({
  entry,
  isNew,
}: {
  entry: LotteryDashboardEntry;
  isNew?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 border-b border-border-light/60 px-4 py-3 transition-all",
        isNew && "animate-in slide-in-from-top-2 fade-in duration-500",
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={entry.avatar_url ?? undefined}
        alt=""
        className="size-9 shrink-0 rounded-full bg-gray-100"
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{entry.name}</p>
        <p className="truncate text-xs text-text-muted">
          {entry.company ?? "—"}
        </p>
      </div>
      <span
        className={cn(
          "shrink-0 rounded px-2 py-0.5 text-[10px] font-semibold",
          INTENT_STYLES[entry.ai_intent_level],
        )}
      >
        {entry.ai_intent_level}级
      </span>
    </div>
  );
}

export function RealtimeEntryFeed({
  entries,
  highlightId,
}: RealtimeEntryFeedProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-border-light bg-white">
      <div className="border-b border-border-light px-4 py-3">
        <h3 className="text-sm font-semibold">实时参与流</h3>
        <p className="text-xs text-text-muted">最新 {entries.length} 条</p>
      </div>
      <div className="max-h-[520px] overflow-y-auto">
        {entries.length === 0 ? (
          <p className="px-4 py-12 text-center text-sm text-text-muted">
            等待第一位参与者…
          </p>
        ) : (
          entries.map((entry) => (
            <EntryRow
              key={entry.id}
              entry={entry}
              isNew={entry.id === highlightId}
            />
          ))
        )}
      </div>
    </div>
  );
}
