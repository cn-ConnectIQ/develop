"use client";

import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Sparkles } from "lucide-react";
import type { LiveOpsConnectionBlock } from "@/lib/live-ops-types";

type ConnectionHeatProps = {
  connections: LiveOpsConnectionBlock;
};

export function ConnectionHeat({ connections }: ConnectionHeatProps) {
  return (
    <section className="rounded-xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
      <h2 className="font-semibold text-white">现场连接</h2>

      <div className="mt-4 flex flex-wrap items-end gap-6">
        <div>
          <p className="text-3xl font-bold tabular-nums text-white">
            {connections.total}
          </p>
          <p className="text-xs text-white/50">
            实时计数
            {connections.trend_delta !== 0 && (
              <span
                className={
                  connections.trend_delta > 0
                    ? " ml-1 text-brand-green"
                    : " ml-1 text-red-400"
                }
              >
                {connections.trend_delta > 0 ? "+" : ""}
                {connections.trend_delta}（近 5 分钟）
              </span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2 rounded-lg bg-brand-purple/15 px-3 py-2">
          <Sparkles className="size-4 text-brand-purple" />
          <div>
            <p className="text-sm font-semibold text-brand-purple">
              AI 促成 {connections.ai_ratio}%
            </p>
            <p className="text-[10px] text-white/50">连接由 AI 推荐发起</p>
          </div>
        </div>
      </div>

      <p className="mt-3 text-sm text-brand-amber">{connections.peak_hint}</p>

      <div className="mt-4 h-36">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={connections.hourly}
            margin={{ top: 4, right: 8, left: -20, bottom: 0 }}
          >
            <XAxis
              dataKey="hour"
              tick={{ fontSize: 10, fill: "rgba(255,255,255,0.4)" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: "rgba(255,255,255,0.4)" }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={{
                background: "#1A1A2E",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 8,
                fontSize: 12,
              }}
            />
            <Line
              type="monotone"
              dataKey="count"
              name="连接数"
              stroke="#534AB7"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
