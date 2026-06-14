"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
import { AdminContent } from "@/components/admin/admin-header";
import { StatCard, StatGrid } from "@/components/admin/stat-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

async function fetchStats() {
  const res = await fetch("/api/platform/points/stats");
  if (!res.ok) throw new Error("加载失败");
  return (await res.json()).data;
}

const PIE_COLORS = ["#EF9F27", "#534AB7", "#185FA5", "#9CA3AF"];
const RANK_COLORS = ["text-brand-gold", "text-gray-400", "text-[#CD7F32]"];

export function PlatformPointsClient() {
  const queryClient = useQueryClient();
  const [showSuspicious, setShowSuspicious] = useState(false);
  const [adjustUserId, setAdjustUserId] = useState("");
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustReason, setAdjustReason] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["platform-points"],
    queryFn: fetchStats,
  });

  async function handleAdjust() {
    if (!adjustUserId || !adjustAmount || !adjustReason) {
      toast.error("请填写完整信息");
      return;
    }
    const res = await fetch("/api/platform/points/adjust", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: adjustUserId,
        amount: Number(adjustAmount),
        reason: adjustReason,
      }),
    });
    if (res.ok) {
      toast.success("积分已补发");
      setAdjustUserId("");
      setAdjustAmount("");
      setAdjustReason("");
      void queryClient.invalidateQueries({ queryKey: ["platform-points"] });
    } else {
      toast.error("操作失败");
    }
  }

  if (isLoading || !data) {
    return (
      <AdminContent>
        <div className="py-20 text-center text-sm text-text-muted">加载中...</div>
      </AdminContent>
    );
  }

  return (
    <AdminContent>
      <h1 className="mb-6 text-xl font-bold">积分管理</h1>

      <StatGrid>
        <StatCard
          label="平台总流通积分"
          value={data.stats.totalCirculation.toLocaleString()}
          accent="amber"
          className="[&_.admin-metric-num]:text-brand-gold"
        />
        <StatCard
          label="本月发放"
          value={data.stats.monthlyIssued.toLocaleString()}
          accent="green"
        />
        <StatCard
          label="本月消耗"
          value={data.stats.monthlySpent.toLocaleString()}
          accent="blue"
        />
        <StatCard label="活跃积分用户" value={data.stats.activeUsers} accent="purple" />
      </StatGrid>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="admin-card p-4">
          <h3 className="mb-4 text-sm font-semibold">积分来源分布</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.sources} layout="vertical" margin={{ left: 80 }}>
                <XAxis type="number" />
                <YAxis type="category" dataKey="reason" width={75} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#EF9F27" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="admin-card p-4">
          <h3 className="mb-4 text-sm font-semibold">权益兑换分布</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data.redemptions} dataKey="value" nameKey="name" outerRadius={80} label>
                  {data.redemptions.map((_: unknown, i: number) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="admin-card mt-6 overflow-hidden">
        <h3 className="border-b px-4 py-3 text-sm font-semibold">积分活跃度 Top 20</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-[#fafaf8] text-left text-text-muted">
              <th className="px-4 py-3">排名</th>
              <th className="px-4 py-3">用户</th>
              <th className="px-4 py-3">本月积分</th>
              <th className="px-4 py-3">余额</th>
              <th className="px-4 py-3">主要来源</th>
            </tr>
          </thead>
          <tbody>
            {data.topUsers.map(
              (user: {
                rank: number;
                name: string;
                company: string;
                monthly: number;
                balance: number;
                source: string;
              }) => (
                <tr key={user.rank} className="border-b border-border-light">
                  <td className={cn("px-4 py-3 font-bold", RANK_COLORS[user.rank - 1] ?? "")}>
                    #{user.rank}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium">{user.name}</p>
                    <p className="text-xs text-text-muted">{user.company}</p>
                  </td>
                  <td className="px-4 py-3 font-medium text-brand-gold">{user.monthly}</td>
                  <td className="px-4 py-3">{user.balance}</td>
                  <td className="px-4 py-3 text-text-muted">{user.source}</td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>

      <div className="admin-card mt-6 p-4">
        <button
          type="button"
          className="flex w-full items-center justify-between text-sm font-semibold"
          onClick={() => setShowSuspicious((v) => !v)}
        >
          异常积分处理
          <span className="text-text-muted">{showSuspicious ? "收起" : "展开"}</span>
        </button>
        {showSuspicious && (
          <ul className="mt-3 space-y-2 text-sm">
            {data.suspicious.map(
              (item: { userId: string; name: string; reason: string; points: number }) => (
                <li
                  key={item.userId}
                  className="flex flex-wrap items-center justify-between gap-2 rounded border p-3"
                >
                  <div>
                    <p className="font-medium">{item.name}</p>
                    <p className="text-xs text-text-muted">
                      {item.reason} · {item.points} 分
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm">撤销</Button>
                    <Button variant="outline" size="sm">忽略</Button>
                    <Button variant="outline" size="sm" className="text-brand-red">封号</Button>
                  </div>
                </li>
              ),
            )}
          </ul>
        )}
      </div>

      <div className="mt-6 rounded-xl bg-brand-blue-light p-4">
        <h3 className="mb-4 font-semibold text-brand-blue">手动补发积分</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1">
            <Label>用户 ID</Label>
            <Input
              placeholder="搜索用户..."
              value={adjustUserId}
              onChange={(e) => setAdjustUserId(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>积分数量</Label>
            <Input
              type="number"
              value={adjustAmount}
              onChange={(e) => setAdjustAmount(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>原因（必填）</Label>
            <Input
              value={adjustReason}
              onChange={(e) => setAdjustReason(e.target.value)}
            />
          </div>
        </div>
        <Button
          className="mt-4 bg-brand-blue hover:bg-brand-blue/90"
          onClick={() => void handleAdjust()}
        >
          确认补发
        </Button>
      </div>
    </AdminContent>
  );
}
