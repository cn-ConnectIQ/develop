"use client";

import { useEffect, useRef, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import type { DashboardStats } from "@/lib/dashboard-types";
import { cn } from "@/lib/utils";

type RealtimeStatsProps = {
  stats?: DashboardStats;
  isLoading?: boolean;
};

function AnimatedNumber({
  value,
  className,
}: {
  value: number | string;
  className?: string;
}) {
  const prev = useRef(value);
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    if (prev.current !== value) {
      prev.current = value;
      setPulse(true);
      const t = setTimeout(() => setPulse(false), 400);
      return () => clearTimeout(t);
    }
  }, [value]);

  return (
    <span
      className={cn(
        "inline-block tabular-nums transition-transform duration-300",
        pulse && "scale-110",
        className,
      )}
    >
      {value}
    </span>
  );
}

export function RealtimeStats({ stats, isLoading }: RealtimeStatsProps) {
  if (isLoading || !stats) {
    return (
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-36 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
      {/* 已签到 */}
      <div className="admin-card admin-card-pad-lg">
        <p className="text-xs text-text-muted">已签到</p>
        <div className="mt-2 flex items-baseline gap-0.5">
          <AnimatedNumber
            value={stats.checkedIn}
            className="text-4xl font-bold text-brand-blue"
          />
          <span className="text-xl text-text-muted">/{stats.participants}</span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-100">
          <div
            className="h-full rounded-full bg-brand-blue transition-all duration-500"
            style={{ width: `${stats.checkInRate}%` }}
          />
        </div>
        <p className="mt-2 flex items-center gap-1.5 text-xs text-text-muted">
          <span className="size-1.5 rounded-full bg-brand-green" />
          实时更新
        </p>
      </div>

      {/* 商业连接 */}
      <div className="admin-card admin-card-pad-lg">
        <p className="text-xs text-text-muted">商业连接</p>
        <AnimatedNumber
          value={stats.connections}
          className="mt-2 block text-3xl font-bold text-brand-purple"
        />
        <p className="mt-2 text-xs text-brand-green">{stats.connectionsDelta}</p>
      </div>

      {/* VIP 到场 */}
      <div className="admin-card admin-card-pad-lg">
        <p className="text-xs text-text-muted">VIP 到场</p>
        <div className="mt-2 text-3xl font-bold text-brand-gold tabular-nums">
          <AnimatedNumber value={stats.vipCheckedIn} />
          <span className="text-xl text-text-muted">/{stats.vipTotal}</span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-100">
          <div
            className="h-full rounded-full bg-brand-gold transition-all duration-500"
            style={{ width: `${stats.vipRate}%` }}
          />
        </div>
      </div>

      {/* 展位线索 */}
      <div className="admin-card admin-card-pad-lg">
        <p className="text-xs text-text-muted">展位线索</p>
        <AnimatedNumber
          value={stats.leads}
          className="mt-2 block text-3xl font-bold text-brand-green"
        />
        <p className="mt-2 text-xs">
          <span className="text-brand-green">A级 {stats.leadsGradeA}</span>
          <span className="text-text-muted"> · </span>
          <span className="text-brand-blue">B级 {stats.leadsGradeB}</span>
          <span className="text-text-muted"> · </span>
          <span className="text-brand-amber">C级 {stats.leadsGradeC}</span>
        </p>
      </div>

      {/* 今日会面 */}
      <div className="admin-card admin-card-pad-lg border-l-[3px] border-l-brand-purple pl-4">
        <p className="text-xs text-text-muted">今日会面</p>
        <AnimatedNumber
          value={stats.meetings.total}
          className="mt-2 block text-2xl font-bold text-brand-purple"
        />
        <div className="mt-2 space-y-0.5 text-xs text-text-muted">
          <p>已完成 {stats.meetings.completed}</p>
          <p>进行中 {stats.meetings.inProgress}</p>
          <p>未出现 {stats.meetings.noShow}</p>
        </div>
      </div>
    </div>
  );
}
