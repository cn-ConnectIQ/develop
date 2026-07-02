"use client";

import { Download, Monitor } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { LotteryDashboardWinner } from "@/lib/lottery/lottery-dashboard-service";

type WinnerListProps = {
  lotteryId: string;
  winners: LotteryDashboardWinner[];
};

function exportWinnersCsv(lotteryId: string, winners: LotteryDashboardWinner[]) {
  const rows = [
    ["姓名", "公司", "奖品", "等级", "核销码", "中奖时间"],
    ...winners.map((w) => [
      w.name,
      w.company ?? "",
      w.prize_name,
      String(w.prize_rank),
      w.verification_code ?? "",
      w.drawn_at,
    ]),
  ];

  const csv = `\uFEFF${rows
    .map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","),
    )
    .join("\n")}`;

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `lottery-winners-${lotteryId.slice(-8)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function WinnerList({ lotteryId, winners }: WinnerListProps) {
  async function handleBroadcast() {
    try {
      const res = await fetch(
        `/api/lotteries/${lotteryId}/broadcast-winners`,
        { method: "POST" },
      );
      const json = (await res.json()) as { error?: string; data?: { sent: boolean } };
      if (!res.ok) throw new Error(json.error ?? "推送失败");
      toast.success(json.data?.sent ? "已同步到大屏" : "推送已发送（Realtime 未配置）");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "推送失败");
    }
  }

  return (
    <div className="rounded-xl border border-border-light bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-light px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold">中奖名单</h3>
          <p className="text-xs text-text-muted">共 {winners.length} 人</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={winners.length === 0}
            onClick={() => exportWinnersCsv(lotteryId, winners)}
          >
            <Download className="mr-1.5 size-4" />
            导出名单
          </Button>
          <Button
            size="sm"
            className="bg-brand-blue hover:bg-brand-blue/90"
            disabled={winners.length === 0}
            onClick={() => void handleBroadcast()}
          >
            <Monitor className="mr-1.5 size-4" />
            同步到大屏
          </Button>
        </div>
      </div>

      {winners.length === 0 ? (
        <p className="px-4 py-10 text-center text-sm text-text-muted">
          尚未开奖
        </p>
      ) : (
        <div className="divide-y divide-border-light/60">
          {winners.map((winner) => (
            <div
              key={winner.id}
              className="flex items-center gap-3 px-4 py-3"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={winner.avatar_url ?? undefined}
                alt=""
                className="size-10 rounded-full bg-gray-100"
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{winner.name}</p>
                <p className="truncate text-xs text-text-muted">
                  {winner.company ?? "—"}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-brand-red">
                  {winner.prize_name}
                </p>
                {winner.verification_code && (
                  <p className="text-[10px] text-text-muted">
                    核销码 {winner.verification_code}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
