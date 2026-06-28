"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Circle,
  Handshake,
  History,
  Sparkles,
  Store,
  TrendingUp,
  Users,
} from "lucide-react";
import { AdminPageBody } from "@/components/layout/AdminLayout";
import { PageHead } from "@/components/admin/page-head";
import { buttonVariants } from "@/components/ui/button";
import type { OrgAccountCenter } from "@/lib/org-account-center-service";
import { cn } from "@/lib/utils";

type TrialOnboarding = {
  onboarding: Array<{ id: string; label: string; done: boolean }>;
  isTrial: boolean;
};

async function fetchAccountCenter() {
  const res = await fetch("/api/me/account-center");
  if (!res.ok) throw new Error("加载失败");
  return (await res.json()).data as OrgAccountCenter;
}

async function fetchTrialOnboarding(): Promise<TrialOnboarding | null> {
  const res = await fetch("/api/me/trial-profile");
  if (!res.ok) return null;
  const data = (await res.json()).data;
  return {
    onboarding: data.onboarding ?? [],
    isTrial: data.isTrial ?? false,
  };
}

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "筹备中",
  PUBLISHED: "已发布",
  LIVE: "进行中",
  ENDED: "已结束",
};

export function OrganizerDashboardClient() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["account-center"],
    queryFn: fetchAccountCenter,
    refetchInterval: 60_000,
  });

  const { data: trialData } = useQuery({
    queryKey: ["trial-profile"],
    queryFn: fetchTrialOnboarding,
    enabled: data?.org.adminStatus === "TRIAL",
  });

  const isTrial = data?.org.adminStatus === "TRIAL";
  const completedSteps =
    trialData?.onboarding.filter((s) => s.done).length ?? 0;

  return (
    <AdminPageBody>
      <PageHead
        title="账号管理中心"
        description={
          isTrial
            ? "试用中 · 您的活动数据将随账号保留，便于下一场复用与对比"
            : "跨活动累计数据与历史记录——B 端账号留存，助力持续办会与参展"
        }
      />

      {isTrial && (
        <div className="mb-6 rounded-2xl border border-brand-blue/20 bg-gradient-to-r from-brand-blue-light/80 to-white p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-blue">
                <Sparkles className="size-4" />
                免费试用：办一场活动，体验现场连接
              </p>
              <h2 className="mt-2 text-lg font-semibold text-[var(--admin-ink)]">
                {data?.org.name}
              </h2>
              <p className="mt-1 max-w-xl text-sm text-text-muted">
                试用期间产生的活动、连接与线索数据会保留在您的账号下，正式升级后可跨场次对比 ROI。
              </p>
            </div>
            <Link
              href="/register/admin"
              className={cn(buttonVariants({ variant: "outline" }), "shrink-0")}
            >
              申请正式账号
            </Link>
          </div>
        </div>
      )}

      <div className="mb-4 rounded-xl border border-border-light bg-content px-4 py-3 text-xs leading-relaxed text-text-muted">
        {data?.dataPolicy.summary ??
          "ConnectIQ「连接完交给微信、不留存」仅适用于参会者。主办方/展商账号保留活动历史与跨活动累计数据。"}
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricTile
          label="累计活动"
          value={data?.totals.totalEvents ?? 0}
          hint={`会议 ${data?.totals.eventsByType.conference ?? 0} · 展会 ${(data?.totals.eventsByType.expo ?? 0) + (data?.totals.eventsByType.exhibition ?? 0)}`}
          icon={CalendarDays}
          loading={isLoading}
        />
        <MetricTile
          label="累计参会者"
          value={data?.totals.totalParticipants ?? 0}
          icon={Users}
          loading={isLoading}
        />
        <MetricTile
          label="累计连接"
          value={data?.totals.totalConnections ?? 0}
          icon={Handshake}
          loading={isLoading}
        />
        <MetricTile
          label="累计线索"
          value={data?.totals.totalLeads ?? 0}
          icon={Store}
          loading={isLoading}
        />
      </div>

      {!isLoading && data && (
        <p className="mb-6 text-sm text-text-muted">{data.retention.valueSummary}</p>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="admin-card admin-card-pad-lg lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-[var(--admin-ink)]">
              <History className="size-4 text-brand-blue" />
              活动历史
            </h3>
            <Link
              href="/events"
              className="text-xs text-brand-blue hover:underline"
            >
              全部活动 →
            </Link>
          </div>

          {isLoading && (
            <p className="py-8 text-center text-sm text-text-muted">加载中…</p>
          )}
          {isError && (
            <p className="py-8 text-center text-sm text-brand-red">加载失败</p>
          )}
          {!isLoading && data && data.eventHistory.length === 0 && (
            <div className="py-8 text-center">
              <p className="text-sm text-text-muted">尚无主办活动</p>
              <Link
                href="/events/new"
                className={cn(
                  buttonVariants(),
                  "mt-3 inline-flex bg-brand-blue hover:bg-brand-blue/90",
                )}
              >
                创建第一场活动
              </Link>
            </div>
          )}
          {data && data.eventHistory.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-text-muted">
                    <th className="pb-2 pr-3">活动</th>
                    <th className="pb-2 pr-3">状态</th>
                    <th className="pb-2 pr-3">参会者</th>
                    <th className="pb-2 pr-3">连接</th>
                    <th className="pb-2 pr-3">线索</th>
                    <th className="pb-2 text-right">趋势</th>
                  </tr>
                </thead>
                <tbody>
                  {data.eventHistory.slice(0, 8).map((event) => (
                    <tr key={event.id} className="border-b last:border-0">
                      <td className="py-2.5 pr-3">
                        <Link
                          href={`/events/${event.id}`}
                          className="font-medium text-brand-blue hover:underline"
                        >
                          {event.name}
                        </Link>
                        {event.startDate && (
                          <p className="text-[11px] text-text-muted">
                            {format(new Date(event.startDate), "yyyy/M/d")}
                          </p>
                        )}
                      </td>
                      <td className="py-2.5 pr-3 text-text-muted">
                        {STATUS_LABEL[event.status] ?? event.status}
                      </td>
                      <td className="py-2.5 pr-3">{event.participants}</td>
                      <td className="py-2.5 pr-3">{event.connections}</td>
                      <td className="py-2.5 pr-3">{event.leads}</td>
                      <td className="py-2.5 text-right">
                        {event.connectionsDelta === null ? (
                          <span className="text-text-tertiary">—</span>
                        ) : event.connectionsDelta >= 0 ? (
                          <span className="inline-flex items-center text-brand-green">
                            <TrendingUp className="mr-0.5 size-3.5" />+
                            {event.connectionsDelta}
                          </span>
                        ) : (
                          <span className="text-text-muted">
                            {event.connectionsDelta}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {data && data.exhibitorHistory.length > 0 && (
            <div className="mt-6 border-t border-border-light pt-4">
              <h4 className="mb-3 text-xs font-semibold text-text-muted">
                参展历史
              </h4>
              <ul className="space-y-2">
                {data.exhibitorHistory.slice(0, 5).map((booth) => (
                  <li
                    key={booth.boothId}
                    className="flex items-center justify-between rounded-lg border border-border-light px-3 py-2 text-sm"
                  >
                    <div>
                      <span className="font-medium">{booth.eventName}</span>
                      <span className="ml-2 font-mono text-xs text-brand-blue">
                        {booth.boothCode}
                      </span>
                    </div>
                    <span className="text-text-muted">{booth.leads} 线索</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <section className="space-y-6">
          {isTrial && trialData && (
            <div className="admin-card admin-card-pad-lg">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-[var(--admin-ink)]">
                  试用上手引导
                </h3>
                <span className="text-xs text-text-muted">
                  {completedSteps}/{trialData.onboarding.length}
                </span>
              </div>
              <ol className="space-y-2">
                {trialData.onboarding.map((step, index) => (
                  <li
                    key={step.id}
                    className="flex items-center gap-2 text-sm"
                  >
                    {step.done ? (
                      <CheckCircle2 className="size-4 shrink-0 text-brand-green" />
                    ) : (
                      <Circle className="size-4 shrink-0 text-text-tertiary" />
                    )}
                    <span
                      className={step.done ? "text-text-muted line-through" : ""}
                    >
                      {index + 1}. {step.label}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          <div className="admin-card admin-card-pad-lg">
            <div className="mb-4 flex items-center gap-2">
              <BarChart3 className="size-4 text-brand-purple" />
              <h3 className="text-sm font-semibold text-[var(--admin-ink)]">
                回来的理由
              </h3>
            </div>
            <p className="mb-4 text-xs text-text-muted">
              不是持久社交，而是 B 端账号价值——让每场活动的投入可累积、可对比、可复用。
            </p>
            <ul className="space-y-3">
              {(data?.retention.hints ?? []).map((hint) => (
                <li key={hint.id}>
                  <Link
                    href={hint.href}
                    className="block rounded-xl border border-border-light px-3 py-3 transition-colors hover:border-brand-blue/40 hover:bg-brand-blue-light/20"
                  >
                    <p className="text-sm font-medium text-[var(--admin-ink)]">
                      {hint.title}
                    </p>
                    <p className="mt-0.5 text-xs text-text-muted">
                      {hint.description}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
            <Link
              href="/events/new"
              className={cn(
                buttonVariants(),
                "mt-4 inline-flex w-full justify-center bg-brand-blue hover:bg-brand-blue/90",
              )}
            >
              创建活动
              <ArrowRight className="ml-1 size-4" />
            </Link>
          </div>
        </section>
      </div>
    </AdminPageBody>
  );
}

function MetricTile({
  label,
  value,
  hint,
  icon: Icon,
  loading,
}: {
  label: string;
  value: number;
  hint?: string;
  icon?: typeof Users;
  loading?: boolean;
}) {
  return (
    <div className="admin-card admin-card-pad-lg">
      <div className="flex items-center justify-between">
        <p className="text-xs text-text-muted">{label}</p>
        {Icon && <Icon className="size-4 text-text-tertiary" />}
      </div>
      <p className="admin-metric-num mt-2 text-brand-blue">
        {loading ? "…" : value}
      </p>
      {hint && <p className="mt-1 text-[11px] text-text-muted">{hint}</p>}
    </div>
  );
}
