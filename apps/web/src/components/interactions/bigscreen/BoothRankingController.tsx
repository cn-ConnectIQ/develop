"use client";

import { Download, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { BoothRankingItem } from "@/lib/booth-rankings-service";
import {
  useBigscreenStore,
  type BoothRankingTopLimit,
} from "@/stores/bigscreenStore";

type BoothRankingControllerProps = {
  eventId: string;
  rankings?: BoothRankingItem[];
  onRefresh: () => void;
};

function exportRankingsCsv(rankings: BoothRankingItem[], eventId: string) {
  const header = "排名,展位号,公司,今日访客,总访客,30分钟增量\n";
  const rows = rankings
    .map(
      (r) =>
        `${r.rank},${r.booth_number},"${r.company_name.replace(/"/g, '""')}",${r.today_visitors},${r.total_visitors},${r.change}`,
    )
    .join("\n");
  const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `booth-rankings-${eventId}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function BoothRankingController({
  eventId,
  rankings = [],
  onRefresh,
}: BoothRankingControllerProps) {
  const eventName = useBigscreenStore((s) => s.eventName);
  const autoRefresh = useBigscreenStore((s) => s.boothRankingAutoRefresh);
  const topLimit = useBigscreenStore((s) => s.boothRankingTopLimit);
  const highlightGrowth = useBigscreenStore((s) => s.boothRankingHighlightGrowth);
  const setAutoRefresh = useBigscreenStore((s) => s.setBoothRankingAutoRefresh);
  const setTopLimit = useBigscreenStore((s) => s.setBoothRankingTopLimit);
  const setHighlightGrowth = useBigscreenStore((s) => s.setBoothRankingHighlightGrowth);

  const limitValue = topLimit === "all" ? "all" : String(topLimit);

  return (
    <aside className="relative flex flex-[0_0_28%] flex-col overflow-y-auto bg-[#0D1117] pb-20 text-white">
      <div className="border-b border-white/10 p-4">
        <p className="truncate text-sm font-medium">{eventName}</p>
        <p className="mt-0.5 text-xs text-white/40">ConnectIQ 控制台</p>
      </div>

      <div className="space-y-5 p-4">
        <p className="font-medium text-white">展位人气控制</p>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-white/60">自动刷新</span>
            <Switch checked={autoRefresh} onCheckedChange={setAutoRefresh} />
          </div>
          <button
            type="button"
            className="flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-white/10 text-sm text-white hover:bg-white/15"
            onClick={onRefresh}
          >
            <RefreshCw className="size-3.5" />
            立即刷新
          </button>
        </div>

        <div className="space-y-2">
          <span className="text-xs text-white/60">显示 Top</span>
          <Select
            value={limitValue}
            onValueChange={(v) =>
              setTopLimit(
                v === "all" ? "all" : (Number(v) as BoothRankingTopLimit),
              )
            }
          >
            <SelectTrigger className="h-9 border-white/20 bg-white/10 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="5">Top 5</SelectItem>
              <SelectItem value="10">Top 10</SelectItem>
              <SelectItem value="15">Top 15</SelectItem>
              <SelectItem value="all">全部</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs text-white/60">突出显示增长最快</span>
          <Switch
            checked={highlightGrowth}
            onCheckedChange={setHighlightGrowth}
          />
        </div>

        <button
          type="button"
          className="flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-white/10 text-sm text-white hover:bg-white/15"
          onClick={() => {
            if (rankings.length === 0) {
              toast.error("暂无数据可导出");
              return;
            }
            exportRankingsCsv(rankings, eventId);
            toast.success("排行榜已导出");
          }}
        >
          <Download className="size-3.5" />
          导出排行榜数据
        </button>
      </div>
    </aside>
  );
}
