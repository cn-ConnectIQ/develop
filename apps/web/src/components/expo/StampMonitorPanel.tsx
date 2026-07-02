"use client";

import { useQuery } from "@tanstack/react-query";
import { Trophy } from "lucide-react";
import { SectionCard } from "@/components/admin/admin-header";
import { Button } from "@/components/ui/button";
import { backgroundPoll } from "@/lib/query-options";

export type StampMonitorBooth = {
  booth_id: string;
  label: string;
  stamp_count: number;
  target_audience: number;
};

export type StampMonitorData = {
  completion_rate: number;
  booths: StampMonitorBooth[];
};

async function fetchStampMonitor(eventId: string): Promise<StampMonitorData> {
  const res = await fetch(`/api/account/events/${eventId}/stamp-monitor`);
  if (!res.ok) throw new Error("加载失败");
  return (await res.json()).data as StampMonitorData;
}

function boothRate(count: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((count / total) * 100);
}

export function StampMonitorPanel({ eventId }: { eventId: string }) {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["stamp-monitor", eventId],
    queryFn: () => fetchStampMonitor(eventId),
    ...backgroundPoll(15_000),
  });

  const booths = data?.booths ?? [];
  const maxCount = Math.max(...booths.map((b) => b.stamp_count), 1);

  return (
    <div id="monitor" className="scroll-mt-6 space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[var(--admin-ink)]">
            集章监控
          </h2>
          <p className="text-sm text-text-muted">各展位打卡热度与全场完成率</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void refetch()}>
          刷新
        </Button>
      </div>

      {isError && (
        <p className="text-sm text-destructive">加载失败，请稍后重试</p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <SectionCard title="全场完成率">
          <div className="flex items-end gap-2">
            <span className="text-4xl font-bold tabular-nums text-brand-blue">
              {isLoading ? "—" : `${data?.completion_rate ?? 0}%`}
            </span>
            <Trophy className="mb-1 size-6 text-brand-amber" />
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            已完成集章的参会者占比
          </p>
        </SectionCard>
        <SectionCard title="监控展位数">
          <span className="text-4xl font-bold tabular-nums">
            {isLoading ? "—" : booths.length}
          </span>
          <p className="mt-2 text-sm text-muted-foreground">
            当前集章活动关联展位
          </p>
        </SectionCard>
      </div>

      <SectionCard title="各展位打卡热度">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">加载中…</p>
        ) : booths.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            暂无集章数据，请先发布集章路线
          </p>
        ) : (
          <ul className="space-y-4">
            {booths.map((booth) => {
              const rate = boothRate(booth.stamp_count, booth.target_audience);
              const barWidth = Math.round((booth.stamp_count / maxCount) * 100);
              return (
                <li key={booth.booth_id}>
                  <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                    <span className="font-medium">{booth.label}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {booth.stamp_count} 次 · {rate}%
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-brand-blue transition-all"
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}
