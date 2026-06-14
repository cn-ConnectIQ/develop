"use client";

import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { QrCode } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { AdminContent } from "@/components/admin/admin-header";
import { LeadStatusBadge } from "@/components/admin/status-badge";
import { formatDateTime } from "@/components/admin/status-badge";
import { useRealtimeBoothLeads } from "@/hooks/useRealtimeBoothLeads";
import { BoothInteractionsSection } from "@/components/exhibitors/BoothInteractionsSection";
import { cn } from "@/lib/utils";

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
  leads: Array<{
    id: string;
    createdAt: string;
    status: string;
    notes: string | null;
    crmSyncStatus?: string;
    participant: { name: string; company: string | null };
    intentTags: Array<{ intentTag: { label: string } }>;
  }>;
};

async function fetchDashboard(boothId: string) {
  const res = await fetch(`/api/booths/${boothId}/dashboard`);
  if (!res.ok) throw new Error("加载失败");
  return (await res.json()).data as BoothDashboardData;
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

  const { data, isLoading } = useQuery({
    queryKey: ["booth-dashboard", boothId],
    queryFn: () => fetchDashboard(boothId),
    refetchInterval: 15000,
  });

  useRealtimeBoothLeads({
    boothId,
    onUpdate: useCallback(() => {
      void queryClient.invalidateQueries({
        queryKey: ["booth-dashboard", boothId],
      });
    }, [boothId, queryClient]),
  });

  if (isLoading || !data) {
    return (
      <AdminContent>
        <div className="py-16 text-center text-sm text-text-muted">加载中...</div>
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
