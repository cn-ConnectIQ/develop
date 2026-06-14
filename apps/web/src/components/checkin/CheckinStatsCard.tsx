"use client";

import { useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import type { CheckinStats } from "@/lib/checkin-types";
import { cn } from "@/lib/utils";

type CheckinStatsCardProps = {
  stats?: CheckinStats;
  lastUpdated?: Date;
};

function AnimatedCount({ value }: { value: number | string }) {
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
      )}
    >
      {value}
    </span>
  );
}

export function CheckinStatsCard({ stats, lastUpdated }: CheckinStatsCardProps) {
  return (
    <div className="mb-6 rounded-2xl border border-border-light bg-white p-6">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div>
          <div className="flex items-baseline gap-2">
            <span className="text-6xl font-bold text-brand-blue">
              <AnimatedCount value={stats?.checkedIn ?? "—"} />
            </span>
            <span className="text-2xl text-text-muted">
              / {stats?.total ?? "—"}
            </span>
          </div>
          <p className="mt-1 text-sm text-text-muted">已签到</p>
          <div className="mt-4 h-3 overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full bg-brand-blue transition-all duration-500"
              style={{ width: `${stats?.rate ?? 0}%` }}
            />
          </div>
          <p className="mt-2 flex items-center gap-1.5 text-xs text-text-muted">
            <span className="size-1.5 rounded-full bg-brand-green" />
            实时更新 · {format(lastUpdated ?? new Date(), "HH:mm")}
          </p>
        </div>

        <div className="flex flex-col justify-center space-y-3 text-sm">
          <p>
            <span className="font-semibold text-brand-gold">VIP 到场：</span>
            {stats?.vipCheckedIn ?? 0}/{stats?.vipTotal ?? 0}
          </p>
          <p>
            <span className="font-semibold text-brand-blue">演讲者：</span>
            {stats?.speakerCheckedIn ?? 0}/{stats?.speakerTotal ?? 0}
          </p>
          <p>
            <span className="font-semibold text-brand-green">今日新增：</span>
            +{stats?.todayNew ?? 0}
          </p>
        </div>
      </div>
    </div>
  );
}
