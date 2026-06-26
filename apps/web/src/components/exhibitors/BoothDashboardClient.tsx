"use client";

import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { backgroundPoll } from "@/lib/query-options";
import Link from "next/link";
import { QrCode } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { AdminContent } from "@/components/admin/admin-header";
import { LeadStatusBadge, CrmSyncStatusBadge, formatDateTime } from "@/components/admin/status-badge";
import { useRealtimeBoothLeads } from "@/hooks/useRealtimeBoothLeads";
import { BoothInteractionsSection } from "@/components/exhibitors/BoothInteractionsSection";
import { cn } from "@/lib/utils";

type HighIntentBuyer = {
  buyer_user_id: string;
  name: string;
  company: string | null;
  intent_level: "A" | "B";
  occurred_at: string;
};

type BoothDashboardData = {
  code: string;
  name: string;
  event: { name: string };
  stats: {
    todayVisitors: number;
    gradeA: number;
    gradeBC: number;
    crmSynced: number;
  };
  highIntentBuyers: HighIntentBuyer[];
  leads: Array<{
    id: string;
    createdAt: string;
    status: string;
    notes: string | null;
    crmSyncStatus?: string;
    crmSyncError?: string | null;
    participant: { name: string; company: string | null };
    intentTags: Array<{ intentTag: { label: string } }>;
  }>;
};

async function fetchDashboard(boothId: string) {
  const res = await fetch(`/api/booths/${boothId}/dashboard`);
  if (!res.ok) throw new Error("加载失败");
  return (await res.json()).data as BoothDashboardData;
}

function formatMinutesAgo(iso: string) {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  return `${hours} 小时前`;
}

function intentLevelBadge(level: "A" | "B") {
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[10px] font-semibold",
        level === "A"
          ? "bg-brand-red-light text-brand-red"
          : "bg-brand-blue-light text-brand-blue",
      )}
    >
      {level} 级
    </span>
  );
}

function gradeBadge(tags: BoothDashboardData["leads"][0]["intentTags"]) {
  const label = tags[0]?.intentTag.label ?? "";
  const isA =
    label.includes("采购") || label.includes("投资") || label.includes("A");
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[10px] font-medium",
        isA
          ? "bg-brand-red-light text-brand-red"
          : "bg-brand-blue-light text-brand-blue",
      )}
    >
      {label || "待评估"}
    </span>
  );
}

export function BoothDashboardClient({ boothId }: { boothId: string }) {
  const queryClient = useQueryClient();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["booth-dashboard", boothId],
    queryFn: () => fetchDashboard(boothId),
    ...backgroundPoll(30_000),
  });

  useRealtimeBoothLeads({
    boothId,
    onUpdate: useCallback(() => {
      void queryClient.invalidateQueries({
        queryKey: ["booth-dashboard", boothId],
      });
    }, [boothId, queryClient]),
  });

  if (isLoading) {
    return (
      <AdminContent>
        <div className="py-16 text-center text-sm text-text-muted">加载中...</div>
      </AdminContent>
    );
  }

  if (isError || !data) {
    return (
      <AdminContent>
        <div className="admin-card mx-auto max-w-lg p-8 text-center">
          <p className="font-semibold">无法加载展位看板</p>
          <p className="mt-2 text-sm text-text-muted">
            请确认已切换到正确的参展商组织，或稍后重试
          </p>
          <button
            type="button"
            className="mt-4 text-sm font-medium text-brand-amber hover:underline"
            onClick={() => void refetch()}
          >
            重试
          </button>
        </div>
      </AdminContent>
    );
  }

  return (
    <AdminContent>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          {
            label: "今日访客",
            value: data.stats.todayVisitors,
            color: "text-brand-amber",
          },
          {
            label: "A 级线索",
            value: data.stats.gradeA,
            color: "text-brand-red",
          },
          {
            label: "B+C 级线索",
            value: data.stats.gradeBC,
            color: "text-brand-blue",
          },
          {
            label: "已写入 CRM",
            value: data.stats.crmSynced,
            color: "text-brand-green",
          },
        ].map((card) => (
          <div key={card.label} className="admin-card p-5">
            <p className="text-[13px] text-text-muted">{card.label}</p>
            <p className={cn("mt-2 text-4xl font-bold", card.color)}>
              {card.value}
            </p>
          </div>
        ))}
      </div>

      <BoothInteractionsSection boothId={boothId} />

      <section id="ai-leads" className="admin-card mt-6 p-5 scroll-mt-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="font-semibold">AI 主动找潜客</h2>
            <p className="mt-1 text-sm text-text-muted">
              基于展位访客行为信号，实时识别高意向买家
            </p>
          </div>
          <Link
            href={`/exhibitor/booths/${boothId}/leads?grade=A`}
            className="shrink-0 rounded-full bg-brand-purple px-3 py-1 text-xs font-medium text-white hover:bg-brand-purple/90"
          >
            查看 A 级潜客
          </Link>
        </div>
        {data.highIntentBuyers.length === 0 ? (
          <p className="mt-4 text-sm text-text-muted">
            暂无高意向买家信号，请确保访客正在扫码签到
          </p>
        ) : (
          <p className="mt-4 text-sm text-brand-green">
            当前有 {data.highIntentBuyers.length} 位高意向买家，见下方列表
          </p>
        )}
      </section>

      <section id="form-preview" className="admin-card mt-6 p-5 scroll-mt-4">
        <h2 className="font-semibold">采集表单预览</h2>
        <p className="mt-2 text-sm text-text-muted">
          访客扫码后将填写主办方配置的采集字段，线索自动进入下方列表。
        </p>
      </section>

      <section id="team" className="admin-card mt-6 p-5 scroll-mt-4">
        <h2 className="font-semibold">展位团队成员</h2>
        <p className="mt-2 text-sm text-text-muted">
          联系主办方添加团队成员，共同跟进展位线索。
        </p>
      </section>

      <section id="target-profile" className="admin-card mt-6 p-5 scroll-mt-4">
        <h2 className="font-semibold">目标客户画像</h2>
        <p className="mt-2 text-sm text-text-muted">
          配置意向标签后，AI 将优先推送匹配的买家信号至本看板。
        </p>
      </section>

      <section id="export" className="admin-card mt-6 p-5 scroll-mt-4">
        <h2 className="font-semibold">线索导出</h2>
        <Link
          href={`/exhibitor/booths/${boothId}/leads#export`}
          className="mt-2 inline-block text-sm text-brand-blue hover:underline"
        >
          前往线索列表导出 →
        </Link>
      </section>

      <section id="report" className="admin-card mt-6 p-5 scroll-mt-4">
        <h2 className="font-semibold">展位 ROI 报告</h2>
        <p className="mt-2 text-sm text-text-muted">
          今日访客 {data.stats.todayVisitors} · A 级 {data.stats.gradeA} · 已同步 CRM{" "}
          {data.stats.crmSynced}
        </p>
      </section>

      {data.highIntentBuyers.length > 0 && (
        <section className="mt-6 space-y-3">
          <h2 className="font-semibold text-brand-red">🎯 今日高意向买家</h2>
          {data.highIntentBuyers.slice(0, 5).map((buyer) => (
            <div
              key={buyer.buyer_user_id}
              className="flex flex-wrap items-center gap-3 rounded-xl border border-brand-red/20 bg-brand-red-light p-3"
            >
              <Avatar className="size-10 shrink-0">
                <AvatarFallback className="bg-white text-sm text-brand-red">
                  {buyer.name.slice(0, 1)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{buyer.name}</p>
                  {intentLevelBadge(buyer.intent_level)}
                </div>
                <p className="truncate text-sm text-text-muted">
                  {buyer.company ?? "—"}
                </p>
                <p className="mt-0.5 text-xs text-text-muted">
                  {formatMinutesAgo(buyer.occurred_at)}关注了你的展位
                </p>
              </div>
              <Link
                href={`/users/${buyer.buyer_user_id}`}
                className="inline-flex h-8 shrink-0 items-center rounded-md bg-brand-blue px-3 text-xs font-medium text-white transition-colors hover:bg-brand-blue/90"
              >
                立即联系
              </Link>
            </div>
          ))}
        </section>
      )}

      <div className="admin-card mt-6 overflow-hidden">
        <div className="border-b border-border-light px-5 py-3">
          <h2 className="font-semibold">来访客户（实时更新）</h2>
          <p className="text-xs text-text-muted">{data.event.name}</p>
        </div>
        <ul className="divide-y divide-border-light">
          {data.leads.map((lead) => (
            <li
              key={lead.id}
              className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm"
            >
              <span className="w-16 shrink-0 text-xs text-text-muted">
                {formatDateTime(lead.createdAt).slice(11, 16)}
              </span>
              <Avatar className="size-8">
                <AvatarFallback className="bg-brand-amber-light text-xs text-brand-amber">
                  {lead.participant.name.slice(0, 1)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="font-medium">{lead.participant.name}</p>
                <p className="truncate text-xs text-text-muted">
                  {lead.participant.company ?? "—"}
                </p>
              </div>
              {gradeBadge(lead.intentTags)}
              <LeadStatusBadge status={lead.status} />
              {lead.crmSyncStatus && (
                <CrmSyncStatusBadge
                  status={lead.crmSyncStatus}
                  error={lead.crmSyncError}
                />
              )}
              {lead.notes && (
                <span className="w-full truncate text-xs text-text-muted sm:w-auto sm:max-w-[200px]">
                  {lead.notes}
                </span>
              )}
            </li>
          ))}
          {data.leads.length === 0 && (
            <li className="px-5 py-10 text-center text-sm text-text-muted">
              暂无来访记录
            </li>
          )}
        </ul>
        {data.leads.length > 0 && (
          <div className="border-t border-border-light px-5 py-3 text-right">
            <Link
              href={`/exhibitor/booths/${boothId}/leads`}
              className="text-[13px] font-medium text-brand-amber hover:underline"
            >
              查看全部线索 →
            </Link>
          </div>
        )}
      </div>

      <button
        type="button"
        className="fixed right-8 bottom-8 flex h-12 items-center gap-2 rounded-full bg-brand-amber px-5 text-sm font-medium text-white shadow-lg transition-colors hover:bg-brand-amber/90"
      >
        <QrCode className="size-5" />
        + 扫码采集
      </button>
    </AdminContent>
  );
}
