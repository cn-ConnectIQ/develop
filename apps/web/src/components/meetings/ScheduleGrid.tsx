"use client";

import type { ApiScheduleGrid } from "@/lib/meetings/schedule-service";
import { cn } from "@/lib/utils";

function abbrev(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length <= 2) return trimmed;
  return trimmed.slice(0, 2);
}

type ScheduleGridProps = {
  grid: ApiScheduleGrid | null;
  loading: boolean;
  onCellClick?: (meetingId: string) => void;
};

export function ScheduleGrid({ grid, loading, onCellClick }: ScheduleGridProps) {
  if (loading && !grid) {
    return (
      <div className="rounded-lg border border-border p-8 text-center text-sm text-text-muted">
        加载时段网格…
      </div>
    );
  }

  if (!grid || grid.rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-text-muted">
        尚未配置会面桌，请先在「会面配置」中添加桌位
      </div>
    );
  }

  if (grid.slots.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-text-muted">
        未设置可约时段，请在「会面配置」中配置开放时间段
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <div className="min-w-[640px]">
        <div
          className="grid border-b border-border bg-muted/40 text-xs font-medium text-text-muted"
          style={{
            gridTemplateColumns: `140px repeat(${grid.slots.length}, minmax(72px, 1fr))`,
          }}
        >
          <div className="sticky left-0 z-10 border-r border-border bg-muted/40 px-3 py-2">
            会面桌 \ 时段
          </div>
          {grid.slots.map((slot, i) => (
            <div key={i} className="border-r border-border px-1 py-2 text-center last:border-r-0">
              {slot.label}
            </div>
          ))}
        </div>

        {grid.rows.map((row) => (
          <div
            key={row.table_id}
            className="grid border-b border-border last:border-b-0"
            style={{
              gridTemplateColumns: `140px repeat(${grid.slots.length}, minmax(72px, 1fr))`,
            }}
          >
            <div className="sticky left-0 z-10 border-r border-border bg-white px-3 py-2">
              <p className="text-sm font-medium text-text">{row.table_name}</p>
              <p className="text-xs text-text-muted">{row.area_name}</p>
            </div>
            {row.cells.map((cell) => {
              const isBooked = cell.status === "booked";
              const isConflict = cell.status === "conflict";
              const label =
                cell.requester_name && cell.recipient_name
                  ? `${abbrev(cell.requester_name)}/${abbrev(cell.recipient_name)}`
                  : "";

              return (
                <button
                  key={cell.slot_index}
                  type="button"
                  disabled={!cell.meeting_id}
                  onClick={() => cell.meeting_id && onCellClick?.(cell.meeting_id)}
                  className={cn(
                    "min-h-[52px] border-r border-border px-1 py-1 text-center text-[10px] leading-tight last:border-r-0 transition-colors",
                    cell.status === "free" && "bg-white text-text-tertiary hover:bg-muted/30",
                    isBooked && "bg-emerald-50 text-emerald-800 hover:bg-emerald-100",
                    isConflict && "bg-red-50 text-red-800 ring-1 ring-inset ring-red-300",
                  )}
                  title={
                    isBooked
                      ? `${cell.requester_name} ↔ ${cell.recipient_name}`
                      : isConflict
                        ? "冲突"
                        : "空闲"
                  }
                >
                  {isBooked || isConflict ? label : "—"}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-4 border-t border-border bg-muted/20 px-4 py-2 text-xs text-text-muted">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded border border-border bg-white" />
          空闲
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded bg-emerald-50 ring-1 ring-emerald-200" />
          已确认
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded bg-red-50 ring-1 ring-red-300" />
          冲突
        </span>
        <span>
          {grid.date} · {grid.slot_minutes} 分钟/场 · 缓冲 {grid.buffer_minutes} 分钟
        </span>
        {grid.conflicts.length > 0 && (
          <span className="font-medium text-red-600">
            {grid.conflicts.length} 处冲突需处理
          </span>
        )}
      </div>
    </div>
  );
}
