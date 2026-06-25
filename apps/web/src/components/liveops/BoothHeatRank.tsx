"use client";

import { useState } from "react";
import { toast } from "sonner";
import { MapPin, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { LiveOpsBoothHeatItem } from "@/lib/live-ops-types";
import { cn } from "@/lib/utils";

type BoothHeatRankProps = {
  eventId: string;
  top: LiveOpsBoothHeatItem[];
  cold: LiveOpsBoothHeatItem[];
};

export function BoothHeatRank({ eventId, top, cold }: BoothHeatRankProps) {
  const [pushing, setPushing] = useState(false);

  async function pushStampReminder() {
    if (cold.length === 0) {
      toast.message("暂无偏冷展位");
      return;
    }
    setPushing(true);
    try {
      const res = await fetch(`/api/events/${eventId}/broadcast`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stamp_booth_ids: cold.map((b) => b.booth_id),
        }),
      });
      if (!res.ok) throw new Error("推送失败");
      const json = await res.json();
      toast.success(`已推送集章提醒（${json.data?.sent ?? 0} 人）`);
    } catch {
      toast.error("推送失败");
    } finally {
      setPushing(false);
    }
  }

  return (
    <section className="rounded-xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-semibold text-white">
          <Trophy className="size-4 text-brand-gold" />
          展位热度榜
        </h2>
        {cold.length > 0 && (
          <Button
            size="sm"
            variant="outline"
            className="border-white/20 text-white hover:bg-white/10"
            disabled={pushing}
            onClick={() => void pushStampReminder()}
          >
            推送集章提醒
          </Button>
        )}
      </div>

      <ol className="mt-4 space-y-2">
        {top.map((booth) => (
          <li
            key={booth.booth_id}
            className="flex items-center gap-3 rounded-lg bg-white/5 px-3 py-2.5"
          >
            <span
              className={cn(
                "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                booth.rank === 1
                  ? "bg-brand-gold/25 text-brand-gold"
                  : "bg-white/10 text-white/70",
              )}
            >
              {booth.rank}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white">
                {booth.company_name}
              </p>
              <p className="text-xs text-white/50">{booth.booth_number}</p>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold tabular-nums text-brand-amber">
                {booth.today_visitors}
              </p>
              {booth.change > 0 && (
                <p className="text-[10px] text-brand-green">+{booth.change}</p>
              )}
            </div>
          </li>
        ))}
        {top.length === 0 && (
          <li className="py-6 text-center text-sm text-white/40">暂无展位数据</li>
        )}
      </ol>

      {cold.length > 0 && (
        <div className="mt-4 border-t border-white/10 pt-4">
          <p className="mb-2 flex items-center gap-1 text-xs text-white/50">
            <MapPin className="size-3" />
            偏冷展位（可针对性引流）
          </p>
          <div className="flex flex-wrap gap-2">
            {cold.map((b) => (
              <span
                key={b.booth_id}
                className="rounded-full bg-white/5 px-2.5 py-1 text-xs text-white/60"
              >
                {b.booth_number} · {b.today_visitors} 人
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
