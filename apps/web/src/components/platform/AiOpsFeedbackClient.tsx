"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bot } from "lucide-react";
import {
  Bar,
  BarChart,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AdminContent } from "@/components/admin/admin-header";
import { StatCard, StatGrid } from "@/components/admin/stat-card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

async function fetchStats() {
  const res = await fetch("/api/platform/ai-ops/feedback-stats");
  if (!res.ok) throw new Error("加载失败");
  return (await res.json()).data;
}

const PIE_COLORS = ["#0F6E56", "#A32D2D", "#185FA5", "#EF9F27", "#534AB7", "#854F0B"];

export function AiOpsFeedbackClient() {
  const queryClient = useQueryClient();
  const [analysis, setAnalysis] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["ai-ops-feedback"],
    queryFn: fetchStats,
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/platform/ai-ops/generate-analysis", {
        method: "POST",
      });
      if (!res.ok) throw new Error("生成失败");
      return (await res.json()).data;
    },
    onSuccess: (result) => {
      setAnalysis(result.text);
      toast.success("分析已生成");
      void queryClient.invalidateQueries({ queryKey: ["ai-ops-feedback"] });
    },
  });

  if (isLoading || !data) {
    return (
      <AdminContent>
        <div className="py-20 text-center text-sm text-text-muted">加载中...</div>
      </AdminContent>
    );
  }

  const displayAnalysis = analysis ?? data.analysis.text;

  return (
    <AdminContent>
      <h1 className="mb-6 text-xl font-bold">用户反馈汇总</h1>

      <StatGrid>
        <StatCard label="总反馈数" value={data.overview.total} accent="blue" />
        <StatCard
          label="正面反馈率"
          value={`${data.overview.positiveRate}%`}
          accent="green"
          className="[&_.admin-metric-num]:text-4xl"
        />
        <StatCard
          label="负面反馈数"
          value={data.overview.negative}
          accent="blue"
          className="[&_.admin-metric-num]:text-brand-red"
        />
        <StatCard
          label="反馈覆盖率"
          value={`${data.overview.coverage}%`}
          accent="purple"
        />
      </StatGrid>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="admin-card p-4">
          <h3 className="mb-4 text-sm font-semibold">反馈类型分布</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.typeDistribution}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={50}
                  outerRadius={80}
                  label={({ name, percent }) =>
                    `${name} ${((percent ?? 0) * 100).toFixed(0)}%`
                  }
                >
                  {data.typeDistribution.map((_: unknown, i: number) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="admin-card p-4">
          <h3 className="mb-4 text-sm font-semibold">负面原因词频</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.negativeReasons} layout="vertical" margin={{ left: 80 }}>
                <XAxis type="number" />
                <YAxis type="category" dataKey="reason" width={75} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#A32D2D" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="admin-card mt-6 p-4">
        <h3 className="mb-4 text-sm font-semibold">近 12 周正面反馈率趋势</h3>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.trend}>
              <XAxis dataKey="week" tick={{ fontSize: 11 }} />
              <YAxis domain={[50, 80]} tick={{ fontSize: 11 }} unit="%" />
              <Tooltip />
              <Line type="monotone" dataKey="rate" stroke="#0F6E56" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="mt-6 rounded-xl bg-brand-purple-light p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bot className="size-5 text-brand-purple" />
            <span className="font-medium text-brand-purple">AI 自动分析摘要</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={generateMutation.isPending}
            onClick={() => generateMutation.mutate()}
          >
            重新生成
          </Button>
        </div>
        <p className="text-sm text-brand-purple">{displayAnalysis}</p>
        <p className="mt-2 text-xs text-text-tertiary">
          生成于 {data.analysis.generatedAt} · 基于 {data.analysis.basedOn} 条反馈
        </p>
      </div>
    </AdminContent>
  );
}
