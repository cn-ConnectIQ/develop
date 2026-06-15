"use client";

import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";

type ChartOption = {
  id: string;
  text: string;
  count: number;
  percentage: number;
};

type RealtimePollChartProps = {
  options: ChartOption[];
};

export function RealtimePollChart({ options }: RealtimePollChartProps) {
  if (options.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-text-muted">暂无投票数据</p>
    );
  }

  const maxPct = Math.max(...options.map((o) => o.percentage), 1);
  const data = options.map((o) => ({
    ...o,
    label: o.text,
    fillPct: (o.percentage / maxPct) * 100,
    isTop: o.percentage === maxPct,
  }));

  return (
    <div className="space-y-3 py-2">
      {data.map((row) => (
        <div key={row.id} className="flex items-center gap-3">
          <span
            className="w-[200px] shrink-0 truncate text-sm"
            title={row.text}
          >
            {row.text}
          </span>
          <div className="relative h-7 flex-1 overflow-hidden rounded-md bg-content-bg">
            <div
              className="absolute inset-y-0 left-0 rounded-md bg-brand-blue transition-all duration-500"
              style={{
                width: `${row.fillPct}%`,
                boxShadow: row.isTop ? "inset 0 0 0 2px #EF9F27" : undefined,
              }}
            />
          </div>
          <span className="w-12 shrink-0 text-right text-sm font-bold text-brand-blue">
            {row.percentage}%
          </span>
        </div>
      ))}
    </div>
  );
}

/** Recharts 横向柱状图（备用） */
export function RealtimePollChartRecharts({ options }: RealtimePollChartProps) {
  const maxCount = Math.max(...options.map((o) => o.percentage), 1);

  return (
    <ResponsiveContainer width="100%" height={options.length * 48 + 24}>
      <BarChart
        data={options}
        layout="vertical"
        margin={{ top: 0, right: 48, left: 0, bottom: 0 }}
      >
        <XAxis type="number" domain={[0, 100]} hide />
        <YAxis
          type="category"
          dataKey="text"
          width={200}
          tick={{ fontSize: 13 }}
          axisLine={false}
          tickLine={false}
        />
        <Bar
          dataKey="percentage"
          animationDuration={500}
          radius={[0, 4, 4, 0]}
        >
          {options.map((entry) => (
            <Cell
              key={entry.id}
              fill="#185FA5"
              stroke={entry.percentage === maxCount ? "#EF9F27" : undefined}
              strokeWidth={entry.percentage === maxCount ? 2 : 0}
            />
          ))}
          <LabelList
            dataKey="percentage"
            position="right"
            formatter={(v) => `${v}%`}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
