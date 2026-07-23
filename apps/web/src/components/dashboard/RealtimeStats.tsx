"use client";

import { Skeleton } from "@/components/ui/skeleton";
import {
  parseConnectionsTrend,
  StatMetricCard,
  StatMetricValue,
} from "@/components/dashboard/StatMetricCard";
import type { DashboardStats } from "@/lib/dashboard-types";

type RealtimeStatsProps = {
  stats?: DashboardStats;
  isLoading?: boolean;
  isError?: boolean;
  errorMessage?: string;
  onRetry?: () => void;
};

export function RealtimeStats({
  stats,
  isLoading,
  isError,
  errorMessage,
  onRetry,
}: RealtimeStatsProps) {
  if (isLoading) {
    return (
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-[132px] rounded-lg" />
        ))}
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="mb-6 rounded-lg border border-border-light bg-white p-6 text-center text-sm text-text-muted">
        {isError ? "实时数据加载失败" : "暂无统计数据"}
        {isError && errorMessage ? (
          <span className="mt-1 block text-xs text-text-muted/80">
            {errorMessage}
          </span>
        ) : null}
        {onRetry && (
          <button
            type="button"
            className="ml-2 text-brand-blue hover:underline"
            onClick={onRetry}
          >
            重试
          </button>
        )}
      </div>
    );
  }

  const connectionsTrend = parseConnectionsTrend(stats.connectionsDelta);

  return (
    <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
      <StatMetricCard
        label="已签到"
        trend={
          stats.checkInRate > 0
            ? { direction: "up", label: `签到率 ${stats.checkInRate}%` }
            : undefined
        }
        footer={`未签到 ${stats.pending} 人`}
      >
        <StatMetricValue
          tone="brand"
          value={stats.checkedIn}
          suffix={`/ ${stats.participants}`}
        />
      </StatMetricCard>

      <StatMetricCard label="商业连接" trend={connectionsTrend}>
        <StatMetricValue tone="primary" value={stats.connections} />
      </StatMetricCard>

      <StatMetricCard
        label="VIP 到场"
        trend={
          stats.vipRate > 0
            ? { direction: "up", label: `到场率 ${stats.vipRate}%` }
            : undefined
        }
      >
        <StatMetricValue
          tone="primary"
          value={stats.vipCheckedIn}
          suffix={stats.vipTotal > 0 ? `/ ${stats.vipTotal}` : undefined}
        />
      </StatMetricCard>

      <StatMetricCard
        label="展位线索"
        footer={
          <>
            A 级 {stats.leadsGradeA} · B 级 {stats.leadsGradeB} · C 级{" "}
            {stats.leadsGradeC}
          </>
        }
      >
        <StatMetricValue tone="brand" value={stats.leads} />
      </StatMetricCard>

      <StatMetricCard
        label="今日会面"
        footer={
          <>
            已完成 {stats.meetings.completed} · 进行中 {stats.meetings.inProgress}
            {stats.meetings.noShow > 0
              ? ` · 未出现 ${stats.meetings.noShow}`
              : ""}
          </>
        }
      >
        <StatMetricValue tone="primary" value={stats.meetings.total} />
      </StatMetricCard>
    </div>
  );
}
