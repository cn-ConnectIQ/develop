"use client";

import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { CheckinHourlyBucket } from "@/lib/checkin-types";

type CheckinHourlyChartProps = {
  data: CheckinHourlyBucket[];
};

export function CheckinHourlyChart({ data }: CheckinHourlyChartProps) {
  return (
    <div className="mb-6 rounded-xl border border-border-light bg-white p-5">
      <h2 className="mb-4 text-sm font-semibold">签到时间分布</h2>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
            <XAxis
              dataKey="hour"
              tick={{ fontSize: 11, fill: "#5F5E5A" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "#5F5E5A" }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
            />
            <Tooltip
              cursor={{ fill: "#E6F1FB" }}
              contentStyle={{
                borderRadius: 8,
                border: "1px solid #D3D1C7",
                fontSize: 12,
              }}
              formatter={(value) => [`${value} 人`, "签到人数"]}
            />
            <Bar
              dataKey="count"
              fill="#185FA5"
              radius={[4, 4, 0, 0]}
              maxBarSize={48}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
