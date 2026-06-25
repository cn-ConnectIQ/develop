"use client";

import { StatCard, StatGrid } from "@/components/admin/stat-card";
import { cn } from "@/lib/utils";

export type ExhibitorDashboardStats = {
  today_visitors: number;
  visitor_delta: number;
  leads_today: number;
  grade_a_leads: number;
  interaction_participants: number;
  ai_recommended_count: number;
  pending_contact_count: number;
};

type ExhibitorStatsCardsProps = {
  stats: ExhibitorDashboardStats;
};

export function ExhibitorStatsCards({ stats }: ExhibitorStatsCardsProps) {
  const visitorTrend =
    stats.visitor_delta === 0
      ? undefined
      : {
          value: `较昨日 ${stats.visitor_delta > 0 ? "+" : ""}${stats.visitor_delta}`,
          positive: stats.visitor_delta >= 0,
        };

  return (
    <StatGrid columns={4}>
      <StatCard
        label="今日访客"
        value={stats.today_visitors}
        trend={visitorTrend}
        accent="amber"
      />
      <StatCard
        label="采集线索"
        value={stats.leads_today}
        hint={`其中 A 级 ${stats.grade_a_leads} 个`}
        accent="green"
      />
      <StatCard
        label="互动参与"
        value={stats.interaction_participants}
        hint="我发起的互动总参与人次"
        accent="purple"
      />
      <div className="admin-card admin-card-pad-lg border-brand-gold/30 bg-gradient-to-br from-brand-gold/5 to-transparent">
        <p className="mb-2 text-[12.5px] text-[var(--admin-gray)]">
          AI 推荐买家
        </p>
        <p className={cn("admin-metric-num text-brand-gold")}>
          {stats.ai_recommended_count}
        </p>
        <p className="mt-2 text-[12px] text-text-tertiary">
          {stats.pending_contact_count} 个待联系
        </p>
      </div>
    </StatGrid>
  );
}
