"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import { CalendarCheck, UserPlus } from "lucide-react";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AdminContent } from "@/components/admin/admin-header";
import { StatCard, StatGrid } from "@/components/admin/stat-card";
import { Button } from "@/components/ui/button";
import { ACCOUNT_TYPE_LABELS } from "@/lib/account-type-labels";
import type { AccountType } from "@connectiq/database";

async function fetchStats() {
  const res = await fetch("/api/platform/overview-stats");
  if (!res.ok) throw new Error("加载失败");
  return (await res.json()).data;
}

export function PlatformOverviewClient() {
  const { data, isLoading, isError, refetch } = useQuery({
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

  const { users, events, connections, organizations, growth } = data;

  return (
    <AdminContent>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-[var(--admin-ink)]">平台概览</h1>
        <p className="mt-1 text-sm text-text-muted">
          整个平台的健康指标与待处理事项
        </p>
      </div>

      <StatGrid columns={5}>
        <StatCard
          label="注册用户"
          value={users.total}
          trend={{
            value: `+${users.thisMonth} 本月`,
            positive: true,
          }}
          accent="blue"
        />
        <StatCard
          label="活跃组织"
          value={organizations.approved}
          hint={`共 ${organizations.total} 个组织`}
          accent="blue"
        />
        <StatCard
          label="进行中活动"
          value={events.live}
          hint={`共 ${events.total} 场活动`}
          accent="green"
          className="bg-brand-green-light/30"
        />
        <StatCard
          label="商业连接"
          value={connections.total}
          trend={{
            value: `+${connections.thisMonth} 本月`,
            positive: true,
          }}
          accent="purple"
          className="[&_.admin-metric-num]:text-4xl"
        />
        <StatCard
          label="待处理"
          value={users.pending_applications + events.pending_review}
          hint="申请 + 活动审核"
          accent="amber"
          className="[&_.admin-metric-num]:text-brand-red"
        />
      </StatGrid>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-brand-amber bg-brand-amber-light p-5">
          <div className="flex items-center gap-2">
            <UserPlus className="size-5 text-brand-amber" />
            <h3 className="font-bold text-brand-amber">
              {users.pending_applications} 个账号申请待审核
            </h3>
          </div>
          <ul className="mt-4 space-y-2">
            {(data.pendingApplicationsPreview ?? []).map(
              (item: {
                orgName: string;
                accountType: AccountType;
                submittedAt: string;
              }) => (
                <li
                  key={`${item.orgName}-${item.submittedAt}`}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="font-medium text-[var(--admin-ink)]">
                    {item.orgName}
                  </span>
                  <span className="text-text-muted">
                    {ACCOUNT_TYPE_LABELS[item.accountType]} ·{" "}
                    {format(new Date(item.submittedAt), "MM-dd HH:mm", {
                      locale: zhCN,
                    })}
                  </span>
                </li>
              ),
            )}
            {!data.pendingApplicationsPreview?.length && (
              <li className="text-sm text-text-muted">暂无待审核申请</li>
            )}
          </ul>
          <Link
            href="/platform/applications"
            className="mt-3 inline-block text-sm font-medium text-brand-amber hover:underline"
          >
            立即审核 →
          </Link>
        </div>

        <div className="rounded-xl border border-brand-blue bg-brand-blue-light p-5">
          <div className="flex items-center gap-2">
            <CalendarCheck className="size-5 text-brand-blue" />
            <h3 className="font-bold text-brand-blue">
              {events.pending_review} 个活动待发布审核
            </h3>
          </div>
          <ul className="mt-4 space-y-2">
            {(data.pendingEventsPreview ?? []).map(
              (item: {
                eventName: string;
                eventType: string;
                submittedAt: string;
              }) => (
                <li
                  key={`${item.eventName}-${item.submittedAt}`}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="font-medium text-[var(--admin-ink)]">
                    {item.eventName}
                  </span>
                  <span className="text-text-muted">
                    {item.eventType === "EXPO" ? "展会" : "会议"} ·{" "}
                    {format(new Date(item.submittedAt), "MM-dd HH:mm", {
                      locale: zhCN,
                    })}
                  </span>
                </li>
              ),
            )}
            {!data.pendingEventsPreview?.length && (
              <li className="text-sm text-text-muted">暂无待审核活动</li>
            )}
          </ul>
          <Link
            href="/platform/event-reviews"
            className="mt-3 inline-block text-sm font-medium text-brand-blue hover:underline"
          >
            立即审核 →
          </Link>
        </div>
      </div>

      <div className="admin-card mt-6 p-4">
        <h3 className="mb-4 text-sm font-semibold">平台增长趋势（近 6 个月）</h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={growth}>
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="users"
                stroke="#185FA5"
                name="注册用户"
                strokeWidth={2}
              />
              <Line
                type="monotone"
                dataKey="organizations"
                stroke="#EF9F27"
                name="活跃组织"
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </AdminContent>
  );
}
