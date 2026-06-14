"use client";

import { useQuery } from "@tanstack/react-query";
import { Bot, ChevronRight } from "lucide-react";
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AdminContent } from "@/components/admin/admin-header";
import { cn } from "@/lib/utils";

async function fetchStats() {
  const res = await fetch("/api/platform/ai-ops/matching-stats");
  if (!res.ok) throw new Error("加载失败");
  return (await res.json()).data;
}

function scoreColor(range: string) {
  const start = parseInt(range.split("-")[0] ?? "0", 10);
  if (start >= 90) return "#534AB7";
  if (start >= 70) return "#185FA5";
  return "#9CA3AF";
}

function actionBadgeClass(action: string) {
  if (action.includes("联系") || action.includes("预约")) {
    return "bg-brand-green-light text-brand-green";
  }
  if (action.includes("查看")) {
    return "bg-brand-blue-light text-brand-blue";
  }
  if (action.includes("忽略")) {
    return "bg-gray-100 text-text-muted";
  }
  return "bg-brand-amber-light text-brand-amber";
}

export function AiOpsMatchingClient() {
  const { data, isLoading } = useQuery({
    queryKey: ["ai-ops-matching"],
    queryFn: fetchStats,
  });

  if (isLoading || !data) {
    return (
      <AdminContent>
        <div className="py-20 text-center text-sm text-text-muted">加载中...</div>
      </AdminContent>
    );
  }

  return (
    <AdminContent>
      <h1 className="mb-6 text-xl font-bold">撮合质量监控</h1>

      <div className="mb-6 flex items-center gap-3 rounded-xl bg-brand-purple-light p-4">
        <Bot className="size-5 text-brand-purple" />
        <p className="text-sm text-brand-purple">
          AI_MATCH_RESULT 表 · 监控 AI 撮合推荐质量
        </p>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-2 lg:grid-cols-5">
        {data.funnel.map(
          (step: { label: string; value: string | number; color: string }, i: number) => (
            <div key={step.label} className="flex items-center gap-2">
              <div className="admin-card flex-1 p-4 text-center">
                <p className="text-xs text-text-muted">{step.label}</p>
                <p className={cn("mt-1 text-2xl font-bold", step.color)}>
                  {step.value}
                </p>
              </div>
              {i < data.funnel.length - 1 && (
                <ChevronRight className="hidden size-4 shrink-0 text-text-tertiary lg:block" />
              )}
            </div>
          ),
        )}
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <div className="admin-card p-4">
          <h3 className="mb-4 text-sm font-semibold">配对分分布</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.scoreDistribution}>
                <XAxis dataKey="range" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {data.scoreDistribution.map(
                    (entry: { range: string }, i: number) => (
                      <Cell key={i} fill={scoreColor(entry.range)} />
                    ),
                  )}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="admin-card p-4">
          <h3 className="mb-4 text-sm font-semibold">场景类型转化率</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.scenarioConversion} layout="vertical" margin={{ left: 90 }}>
                <XAxis type="number" unit="%" />
                <YAxis type="category" dataKey="scenario" width={85} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="rate" fill="#534AB7" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="admin-card overflow-x-auto p-4">
        <h3 className="mb-4 text-sm font-semibold">推荐明细</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-text-muted">
              <th className="pb-2 pr-4">配对</th>
              <th className="pb-2 pr-4">配对分</th>
              <th className="pb-2 pr-4">推荐理由</th>
              <th className="pb-2 pr-4">用户操作</th>
              <th className="pb-2">建立连接</th>
            </tr>
          </thead>
          <tbody>
            {data.recommendations.map(
              (row: {
                id: string;
                userA: string;
                userB: string;
                score: number;
                reason: string;
                action: string;
                connected: boolean;
              }) => (
                <tr key={row.id} className="border-b border-border-light">
                  <td className="py-3 pr-4">
                    {row.userA} → {row.userB}
                  </td>
                  <td className="py-3 pr-4 font-medium text-brand-purple">
                    {row.score}
                  </td>
                  <td className="py-3 pr-4 text-text-muted">{row.reason}</td>
                  <td className="py-3 pr-4">
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-xs",
                        actionBadgeClass(row.action),
                      )}
                    >
                      {row.action}
                    </span>
                  </td>
                  <td className="py-3">
                    {row.connected ? (
                      <span className="text-brand-green">是</span>
                    ) : (
                      <span className="text-text-muted">否</span>
                    )}
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>
    </AdminContent>
  );
}
