"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
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
import { PageHead } from "@/components/admin/page-head";
import { StatCard, StatGrid } from "@/components/admin/stat-card";
import { Button } from "@/components/ui/button";

async function fetchStats() {
  const res = await fetch("/api/platform/overview-stats");
  if (!res.ok) throw new Error("加载失败");
  return (await res.json()).data;
}

const PIE_COLORS = ["#185FA5", "#534AB7"];

export function PlatformOverviewClient() {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["platform-overview"],
    queryFn: fetchStats,
    retry: 1,
  });

  if (isLoading) {
    return (
      <AdminContent>
        <div className="py-20 text-center text-sm text-text-muted">加载中...</div>
      </AdminContent>
    );
  }

  if (isError || !data) {
    return (
      <AdminContent>
        <div className="admin-card mx-auto max-w-lg p-8 text-center">
          <p className="font-semibold">无法加载平台概览</p>
          <p className="mt-2 text-sm text-text-muted">
            {(error as Error)?.message === "加载失败"
              ? "当前账号可能没有平台管理员权限，请使用 admin@connectiq.test 登录，或在顶栏切换为「平台管理员」角色。"
              : "数据加载失败，请稍后重试。"}
          </p>
          <Button
            type="button"
            variant="outline"
            className="mt-4"
            onClick={() => void refetch()}
          >
            重试
          </Button>
        </div>
      </AdminContent>
    );
  }

  const { stats, growth, eventTypes, pending } = data;

  return (
    <AdminContent>
      <PageHead
        title="平台概览"
        description="整个平台的健康指标，非单场活动数据"
        actions={
          <select className="h-[34px] rounded-lg border border-border-light bg-white px-3 text-[13px] text-[var(--admin-ink)]">
            <option>近 30 天</option>
            <option>近 90 天</option>
            <option>近 12 个月</option>
          </select>
        }
      />

      <StatGrid columns={5}>
        <StatCard
          label="注册用户总数"
          value={stats.totalUsers}
          hint={`+${stats.weeklyNewUsers} 本周新增`}
          accent="blue"
        />
        <StatCard label="DAU" value={stats.dau} accent="green" />
        <StatCard label="活动场次" value={stats.events} accent="blue" />
        <StatCard
          label="商业连接总数"
          value={stats.connections}
          accent="purple"
          className="[&_.admin-metric-num]:text-4xl"
        />
        <StatCard
          label="MarketUP 转化"
          value={stats.marketupConversions}
          accent="amber"
        />
      </StatGrid>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="admin-card p-4">
          <h3 className="mb-4 text-sm font-semibold">注册用户 vs 商业连接</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={growth}>
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line type="monotone" dataKey="users" stroke="#185FA5" name="注册用户" />
                <Line type="monotone" dataKey="connections" stroke="#534AB7" name="商业连接" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="admin-card p-4">
          <h3 className="mb-4 text-sm font-semibold">活动类型分布</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={eventTypes} dataKey="value" nameKey="name" outerRadius={90} label>
                  {eventTypes.map((_: unknown, i: number) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: "内容审核",
            count: pending.contentReview,
            color: "text-brand-red",
            href: "/moderation",
            action: "去审核",
          },
          {
            label: "用户举报",
            count: pending.userReports,
            color: "text-brand-amber",
            href: "/platform/users",
            action: "去处理",
          },
          {
            label: "AI 标签合并建议",
            count: pending.tagMergeSuggestions,
            color: "text-brand-purple",
            href: "/platform/ai-ops/matching",
            action: "查看",
          },
          {
            label: "数据同步异常",
            count: pending.syncErrors,
            color: "text-brand-amber",
            href: "/platform/connections",
            action: "处理",
          },
        ].map((item) => (
          <div key={item.label} className="admin-card flex items-center justify-between p-4">
            <div>
              <p className="text-sm text-text-muted">{item.label}</p>
              <p className={`text-2xl font-bold ${item.color}`}>{item.count}</p>
            </div>
            <Link href={item.href}>
              <Button variant="outline" size="sm">
                {item.action}
              </Button>
            </Link>
          </div>
        ))}
      </div>
    </AdminContent>
  );
}
