"use client";

import { format } from "date-fns";
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type {
  LiveOpsCheckinItem,
  LiveOpsVelocityBucket,
} from "@/lib/live-ops-types";
import { cn } from "@/lib/utils";

type CheckinStreamProps = {
  rate: number;
  recent: LiveOpsCheckinItem[];
  velocity: LiveOpsVelocityBucket[];
};

export function CheckinStream({ rate, recent, velocity }: CheckinStreamProps) {
  const ringData = [
    { name: "已签到", value: rate },
    { name: "未签到", value: Math.max(0, 100 - rate) },
  ];

  return (
    <section className="rounded-xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
      <h2 className="font-semibold text-white">实时签到</h2>

      <div className="mt-4 flex flex-wrap items-center gap-6">
        <div className="relative size-28">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={ringData}
                dataKey="value"
                innerRadius={36}
                outerRadius={52}
                startAngle={90}
                endAngle={-270}
                stroke="none"
              >
                <Cell fill="#0F6E56" />
                <Cell fill="rgba(255,255,255,0.08)" />
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-xl font-bold text-brand-green">{rate}%</span>
            <span className="text-[10px] text-white/50">签到率</span>
          </div>
        </div>

        <div className="h-24 min-w-[140px] flex-1">
          <p className="mb-2 text-xs text-white/50">每 10 分钟签到人数</p>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={velocity} margin={{ top: 0, right: 0, left: -24, bottom: 0 }}>
              <XAxis
                dataKey="label"
                tick={{ fontSize: 9, fill: "rgba(255,255,255,0.4)" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis hide allowDecimals={false} />
              <Tooltip
                contentStyle={{
                  background: "#1A1A2E",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Bar dataKey="count" fill="#185FA5" radius={[3, 3, 0, 0]} maxBarSize={24} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <ul className="mt-4 max-h-64 space-y-2 overflow-y-auto">
        {recent.map((item, index) => (
          <li
            key={item.id}
            className={cn(
              "flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-all",
              index === 0 ? "bg-brand-green/15 animate-in slide-in-from-top-2" : "bg-white/5",
            )}
          >
            <div className="min-w-0">
              <p className="truncate font-medium text-white">{item.name}</p>
              <p className="truncate text-xs text-white/50">
                {item.company ?? "—"}
              </p>
            </div>
            <span className="shrink-0 text-xs text-white/40">
              {format(new Date(item.checked_in_at), "HH:mm:ss")}
            </span>
          </li>
        ))}
        {recent.length === 0 && (
          <li className="py-8 text-center text-sm text-white/40">等待首位签到</li>
        )}
      </ul>
    </section>
  );
}
