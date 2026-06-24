"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { ExternalLink, Monitor, RefreshCw, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import {
  AdminContent,
  AdminHeader,
  AdminPage,
  SectionCard,
} from "@/components/admin/admin-header";
import { Button } from "@/components/ui/button";
import { FeatureFlagGate } from "@/components/events/FeatureFlagGate";
import type { BoothRankingItem } from "@/lib/booth-rankings-service";

async function fetchRankings(eventId: string) {
  const res = await fetch(`/api/events/${eventId}/booth-rankings`);
  if (!res.ok) throw new Error("加载失败");
  return (await res.json()).data as {
    event_name: string;
    rankings: BoothRankingItem[];
  };
}

function ChangeBadge({ change }: { change: number }) {
  if (change === 0) return <span className="text-text-muted">—</span>;
  const up = change > 0;
  return (
    <span className={up ? "text-brand-green" : "text-brand-red"}>
      {up ? "↑" : "↓"}
      {Math.abs(change)}
    </span>
  );
}

function BoothRankingContent({ eventId }: { eventId: string }) {
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["booth-ranking-admin", eventId],
    queryFn: () => fetchRankings(eventId),
    refetchInterval: 60_000,
  });

  const rankings = data?.rankings ?? [];

  return (
    <AdminPage>
      <AdminHeader
        title="展位人气榜"
        description={data?.event_name ?? "实时展位访问与互动热度"}
        breadcrumb={["展会", "展位人气榜"]}
        actions={
          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={isFetching}
              onClick={() => {
                void refetch();
                toast.success("已刷新");
              }}
            >
              <RefreshCw
                className={`mr-1 size-4 ${isFetching ? "animate-spin" : ""}`}
              />
              刷新
            </Button>
            <a
              href={`/events/${eventId}/interactions/bigscreen?tab=booth_ranking`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-9 items-center rounded-lg bg-brand-purple px-4 text-sm text-white hover:bg-brand-purple/90"
            >
              <Monitor className="mr-1 size-4" />
              大屏投放
            </a>
          </div>
        }
      />

      <AdminContent>
        <SectionCard
          title="AI-03 · 展位热度排行"
          description="综合扫码访问与线索采集计算展位人气，可在互动大屏「展位排行」Tab 投放"
        >
          {isLoading ? (
            <p className="py-12 text-center text-sm text-text-muted">加载中…</p>
          ) : rankings.length === 0 ? (
            <div className="py-12 text-center">
              <TrendingUp className="mx-auto size-10 text-text-tertiary" />
              <p className="mt-3 text-sm text-text-muted">
                暂无排行数据，展会开始后随访客扫码与线索采集更新
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border-light">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-[#fafaf8] text-left text-xs text-text-muted">
                    <th className="p-3 w-14">排名</th>
                    <th className="p-3">展位</th>
                    <th className="p-3">展商</th>
                    <th className="p-3">今日访客</th>
                    <th className="p-3">累计访客</th>
                    <th className="p-3">30 分钟变化</th>
                  </tr>
                </thead>
                <tbody>
                  {rankings.map((row) => (
                    <tr key={row.booth_id} className="border-b hover:bg-gray-50/80">
                      <td className="p-3">
                        <span
                          className={
                            row.rank <= 3
                              ? "font-bold text-brand-gold"
                              : "font-medium text-text-muted"
                          }
                        >
                          #{row.rank}
                        </span>
                      </td>
                      <td className="p-3 font-mono text-brand-blue">
                        {row.booth_number}
                      </td>
                      <td className="p-3">{row.company_name}</td>
                      <td className="p-3 tabular-nums font-medium">
                        {row.today_visitors}
                      </td>
                      <td className="p-3 tabular-nums">{row.total_visitors}</td>
                      <td className="p-3 tabular-nums">
                        <ChangeBadge change={row.change} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-3 text-sm">
            <Link
              href={`/expos/${eventId}/booths`}
              className="inline-flex items-center text-brand-blue hover:underline"
            >
              <ExternalLink className="mr-1 size-3.5" />
              展位管理
            </Link>
            <Link
              href={`/events/${eventId}/settings`}
              className="text-text-muted hover:text-brand-blue"
            >
              功能模块设置
            </Link>
          </div>
        </SectionCard>
      </AdminContent>
    </AdminPage>
  );
}

export function BoothRankingPageClient({ eventId }: { eventId: string }) {
  return (
    <FeatureFlagGate
      eventId={eventId}
      flag="boothRanking"
      title="展位人气榜"
      description="AI-03 展位热度排行"
    >
      <BoothRankingContent eventId={eventId} />
    </FeatureFlagGate>
  );
}
