"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AdminContent } from "@/components/admin/admin-header";
import { StatCard, StatGrid } from "@/components/admin/stat-card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

async function fetchStats() {
  const res = await fetch("/api/platform/ai-ops/generation-stats");
  if (!res.ok) throw new Error("加载失败");
  return (await res.json()).data;
}

export function AiOpsGenerationClient() {
  const { data, isLoading } = useQuery({
    queryKey: ["ai-ops-generation"],
    queryFn: fetchStats,
  });

  if (isLoading || !data) {
    return (
      <AdminContent>
        <div className="py-20 text-center text-sm text-text-muted">加载中...</div>
      </AdminContent>
    );
  }

  const { costs, adoptionByType, promptVersions, qualitySamples } = data;

  return (
    <AdminContent>
      <h1 className="mb-6 text-xl font-bold">内容生成监控</h1>

      <StatGrid>
        <StatCard label="本月调用次数" value={costs.calls} accent="blue" />
        <StatCard
          label="Token 消耗"
          value={`${(costs.tokens / 10000).toFixed(1)}万`}
          accent="blue"
        />
        <StatCard
          label="估算费用"
          value={`¥${costs.estimatedCost}`}
          accent="amber"
        />
        <StatCard
          label="AI 内容采用率"
          value={`${costs.adoptionRate}%`}
          accent="green"
        />
      </StatGrid>

      <div className="admin-card mt-6 p-4">
        <h3 className="mb-4 text-sm font-semibold">各类型采用率</h3>
        <div className="space-y-3">
          {adoptionByType.map(
            (item: { type: string; rate: number; editRate: number }) => (
              <div key={item.type}>
                <div className="mb-1 flex justify-between text-sm">
                  <span>{item.type}</span>
                  <span className="text-text-muted">
                    {item.rate}% · 编辑率 {item.editRate}%
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="h-full rounded-full bg-brand-blue"
                    style={{ width: `${item.rate}%` }}
                  />
                </div>
              </div>
            ),
          )}
        </div>
      </div>

      <div className="admin-card mt-6 overflow-x-auto p-4">
        <h3 className="mb-4 text-sm font-semibold">Prompt 版本对比</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-text-muted">
              <th className="pb-2 pr-4">版本</th>
              <th className="pb-2 pr-4">类型</th>
              <th className="pb-2 pr-4">采用率</th>
              <th className="pb-2 pr-4">编辑率</th>
              <th className="pb-2 pr-4">平均 Token</th>
              <th className="pb-2">状态</th>
            </tr>
          </thead>
          <tbody>
            {promptVersions.map(
              (row: {
                version: string;
                type: string;
                adoption: number;
                editRate: number;
                avgTokens: number;
                status: string;
              }) => (
                <tr key={row.version + row.type} className="border-b border-border-light">
                  <td className="py-3 pr-4 font-mono">{row.version}</td>
                  <td className="py-3 pr-4">{row.type}</td>
                  <td className="py-3 pr-4">{row.adoption}%</td>
                  <td className="py-3 pr-4">{row.editRate}%</td>
                  <td className="py-3 pr-4">{row.avgTokens}</td>
                  <td className="py-3">
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-xs",
                        row.status === "ACTIVE"
                          ? "bg-brand-green-light text-brand-green"
                          : "bg-gray-100 text-text-muted",
                      )}
                    >
                      {row.status === "ACTIVE" ? "使用中" : "已废弃"}
                    </span>
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-6 rounded-xl bg-brand-purple-light p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold text-brand-purple">内容质量随机抽查</h3>
          <span className="text-sm text-brand-purple">
            已评级 {qualitySamples.reviewed}/{qualitySamples.total}
          </span>
        </div>
        <div className="mb-2 h-2 overflow-hidden rounded-full bg-white/60">
          <Progress
            value={qualitySamples.reviewed}
            max={qualitySamples.total}
            className="h-2 bg-white/60"
            indicatorClassName="bg-brand-purple"
          />
        </div>
        <ul className="mt-4 space-y-3">
          {qualitySamples.items.map(
            (item: { id: string; type: string; preview: string; rating: string | null }) => (
              <li key={item.id} className="rounded-lg bg-white p-3">
                <span className="rounded bg-brand-purple-light px-2 py-0.5 text-xs text-brand-purple">
                  {item.type}
                </span>
                <p className="mt-2 line-clamp-2 text-sm text-text-muted">
                  {item.preview}
                </p>
                <div className="mt-2 flex gap-2">
                  {(["优秀", "合格", "需优化"] as const).map((label) => (
                    <Button key={label} variant="outline" size="sm" className="h-7 text-xs">
                      {label}
                    </Button>
                  ))}
                </div>
              </li>
            ),
          )}
        </ul>
      </div>
    </AdminContent>
  );
}
