"use client";

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

type PollResultCardProps = {
  title: string;
  total: number;
  type?: string;
  options: Array<{
    id: string;
    text: string;
    count: number;
    percentage: number;
  }>;
  wordCloud?: Array<{ text: string; count: number }>;
  averageRating?: number;
};

const COLORS = ["#185FA5", "#534AB7", "#0F6E56", "#EF9F27", "#854F0B"];

export function PollResultCard({
  title,
  total,
  type,
  options,
  wordCloud = [],
  averageRating,
}: PollResultCardProps) {
  return (
    <div className="rounded-xl border border-border-light bg-white p-5">
      <h3 className="mb-1 font-semibold">{title}</h3>
      <p className="mb-4 text-sm text-text-muted">共 {total} 人参与</p>

      {type === "WORD_CLOUD" && wordCloud.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-2">
          {wordCloud.slice(0, 30).map((item) => (
            <span
              key={item.text}
              className="rounded-full bg-brand-purple-light px-3 py-1 text-brand-purple"
              style={{ fontSize: `${Math.min(20, 12 + item.count * 2)}px` }}
            >
              {item.text} ({item.count})
            </span>
          ))}
        </div>
      )}

      {type === "RATING" && averageRating != null && (
        <p className="mb-4 text-3xl font-bold text-brand-amber">
          {averageRating.toFixed(1)} <span className="text-base font-normal text-text-muted">/ 5 平均分</span>
        </p>
      )}

      {options.length > 0 && (
        <>
          <div className="mb-6 h-56">
            <ResponsiveContainer width="100%" height="100%">
              {type === "RATING" ? (
                <PieChart>
                  <Pie
                    data={options}
                    dataKey="count"
                    nameKey="text"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={(props) => {
                      const p = props as unknown as {
                        text?: string;
                        percentage?: number;
                      };
                      return `${p.text ?? ""} ${p.percentage ?? 0}%`;
                    }}
                  >
                    {options.map((_, index) => (
                      <Cell key={index} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              ) : (
                <BarChart
                  data={options}
                  layout="vertical"
                  margin={{ left: 80, right: 16 }}
                >
                  <XAxis type="number" hide />
                  <YAxis
                    type="category"
                    dataKey="text"
                    width={75}
                    tick={{ fontSize: 12 }}
                  />
                  <Tooltip
                    formatter={(value, _name, item) => [
                      `${value ?? 0} 票 (${(item?.payload as { percentage?: number })?.percentage ?? 0}%)`,
                      "票数",
                    ]}
                  />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {options.map((_, index) => (
                      <Cell key={index} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>

          <ul className="space-y-2">
            {options.map((option, index) => (
              <li key={option.id}>
                <div className="mb-1 flex justify-between text-sm">
                  <span>{option.text}</span>
                  <span className="text-text-muted">
                    {option.count} 票 · {option.percentage}%
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${option.percentage}%`,
                      backgroundColor: COLORS[index % COLORS.length],
                    }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
