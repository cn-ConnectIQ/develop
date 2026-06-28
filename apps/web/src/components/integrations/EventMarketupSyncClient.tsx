"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import Link from "next/link";
import { Bot, ClipboardList, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import {
  AdminContent,
  AdminHeader,
  AdminPage,
} from "@/components/admin/admin-header";
import { CrmSyncStatusBadge } from "@/components/admin/status-badge";
import { StatCard, StatGrid } from "@/components/admin/stat-card";
import { Button } from "@/components/ui/button";
import type { MarketupSyncConfig } from "@/types/booth";
import { cn } from "@/lib/utils";

type SyncStats = {
  synced: number;
  pending: number;
  failed: number;
  total: number;
  fieldMap: Record<string, string>;
  syncConfig: MarketupSyncConfig;
  recentLeads: Array<{
    id: string;
    participantName: string;
    boothCode: string;
    status: string;
    error: string | null;
    syncedAt: string | null;
    createdAt: string;
    marketupLeadId: string | null;
  }>;
  failures: Array<{
    id: string;
    leadId: string;
    participantName: string;
    boothCode: string;
    errorMessage: string;
    attemptedAt: string;
  }>;
};

async function fetchSyncStats(eventId: string) {
  const res = await fetch(`/api/events/${eventId}/marketup-sync`);
  if (!res.ok) throw new Error("加载失败");
  return (await res.json()).data as SyncStats;
}

export function EventMarketupSyncClient({
  eventId,
  embedded = false,
}: {
  eventId: string;
  embedded?: boolean;
}) {
  const queryClient = useQueryClient();

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["event-marketup-sync", eventId],
    queryFn: () => fetchSyncStats(eventId),
    refetchInterval: 30_000,
  });

  const retryMutation = useMutation({
    mutationFn: async (payload: { leadId?: string; jobId?: string }) => {
      const res = await fetch(`/api/events/${eventId}/marketup-sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("重试失败");
    },
    onSuccess: () => {
      toast.success("已重新同步");
      void queryClient.invalidateQueries({
        queryKey: ["event-marketup-sync", eventId],
      });
    },
    onError: () => toast.error("重试失败"),
  });

  if (isLoading) {
    const loading = (
      <p className="py-20 text-center text-sm text-text-muted">加载中…</p>
    );
    if (embedded) return loading;
    return (
      <AdminPage>
        <AdminContent>{loading}</AdminContent>
      </AdminPage>
    );
  }

  if (isError || !data) {
    const error = (
      <p className="py-16 text-center text-sm text-brand-red">加载失败</p>
    );
    if (embedded) return error;
    return (
      <AdminPage>
        <AdminHeader title="MarketUP 同步" breadcrumb={["活动", "MarketUP 同步"]} />
        <AdminContent>{error}</AdminContent>
      </AdminPage>
    );
  }

  const syncRate =
    data.total > 0 ? Math.round((data.synced / data.total) * 1000) / 10 : 0;

  const headerActions = (
    <div className="flex gap-2">
      <Button
        variant="outline"
        disabled={isFetching}
        onClick={() => void refetch()}
      >
        <RefreshCw
          className={cn("mr-1 size-4", isFetching && "animate-spin")}
        />
        刷新
      </Button>
      <Link
        href={`/events/${eventId}/exhibitors/form-config`}
        className="inline-flex h-9 items-center rounded-lg border border-border-light px-4 text-sm hover:bg-content"
      >
        <ClipboardList className="mr-1 size-4" />
        字段映射配置
      </Link>
    </div>
  );

  const body = (
    <>
      {!embedded && (
        <AdminHeader
          title="MarketUP CRM 同步"
          description="现场采集线索自动回流 MarketUP（S2D），配置映射后新线索将实时推送"
          breadcrumb={["活动", "MarketUP 同步"]}
          actions={headerActions}
        />
      )}
      {embedded && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-[var(--admin-ink)]">
            MarketUP CRM 同步
          </h2>
          {headerActions}
        </div>
      )}

      <AdminContent className={embedded ? "px-0" : undefined}>
        <StatGrid columns={4}>
          <StatCard label="已同步" value={data.synced} accent="green" />
          <StatCard label="同步中" value={data.pending} accent="blue" />
          <StatCard label="同步失败" value={data.failed} accent="purple" />
          <StatCard
            label="同步成功率"
            value={`${syncRate}%`}
            hint={`共 ${data.total} 条线索`}
            accent="blue"
          />
        </StatGrid>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <div className="admin-card p-5">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <Bot className="size-4 text-brand-purple" />
              当前映射规则
            </h3>
            <p className="mb-3 text-xs text-text-muted">
              写入策略：{data.syncConfig.writeStrategy === "upsert" ? "新建 + 更新" : "仅新建"}
              · A 级自动分配销售：
              {data.syncConfig.triggers.assignSalesOnA ? "开" : "关"}
            </p>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b text-left text-text-muted">
                  <th className="pb-2">ConnectIQ</th>
                  <th className="pb-2">MarketUP</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(data.fieldMap).slice(0, 8).map(([src, target]) => (
                  <tr key={src} className="border-b">
                    <td className="py-2">{src}</td>
                    <td className="py-2 text-text-muted">{target}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Link
              href={`/events/${eventId}/exhibitors/form-config`}
              className="mt-3 inline-block text-xs text-brand-blue hover:underline"
            >
              编辑字段映射 →
            </Link>
          </div>

          <div className="admin-card p-5">
            <h3 className="mb-3 text-sm font-semibold">自动化触发</h3>
            <ul className="space-y-2 text-sm">
              <li className="flex justify-between rounded-lg border px-3 py-2">
                <span>线索采集后自动同步</span>
                <span className="font-medium text-brand-green">已启用</span>
              </li>
              <li className="flex justify-between rounded-lg border px-3 py-2">
                <span>A 级线索分配销售</span>
                <span className="text-text-muted">
                  {data.syncConfig.triggers.assignSalesOnA ? "已启用" : "未启用"}
                </span>
              </li>
              <li className="flex justify-between rounded-lg border px-3 py-2">
                <span>活动结束培育序列</span>
                <span className="text-text-muted">
                  {data.syncConfig.triggers.nurtureOnEnd ? "已启用" : "未启用"}
                </span>
              </li>
            </ul>
            <Link
              href="/integrations/marketup"
              className="mt-3 inline-block text-xs text-brand-blue hover:underline"
            >
              平台级 MarketUP 配置 →
            </Link>
          </div>
        </div>

        {data.failures.length > 0 && (
          <div className="admin-card mt-6 overflow-hidden border-brand-red/30">
            <h3 className="border-b bg-brand-red-light/50 px-4 py-3 text-sm font-semibold text-brand-red">
              同步失败（{data.failures.length}）
            </h3>
            <ul className="divide-y">
              {data.failures.map((item) => (
                <li
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
                >
                  <div>
                    <p className="font-medium">
                      {item.participantName}{" "}
                      <span className="text-text-muted">· {item.boothCode}</span>
                    </p>
                    <p className="text-xs text-text-muted">
                      {format(new Date(item.attemptedAt), "MM-dd HH:mm")} ·{" "}
                      {item.errorMessage}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={retryMutation.isPending}
                    onClick={() => retryMutation.mutate({ jobId: item.id })}
                  >
                    重试
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="admin-card mt-6 overflow-hidden">
          <h3 className="border-b px-4 py-3 text-sm font-semibold">最近线索同步状态</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-[#fafaf8] text-left text-xs text-text-muted">
                <th className="px-4 py-3">访客</th>
                <th className="px-4 py-3">展位</th>
                <th className="px-4 py-3">采集时间</th>
                <th className="px-4 py-3">CRM 状态</th>
                <th className="px-4 py-3 text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {data.recentLeads.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-text-muted">
                    暂无线索，现场采集后将自动同步至 MarketUP
                  </td>
                </tr>
              ) : (
                data.recentLeads.map((lead) => (
                  <tr key={lead.id} className="border-b last:border-0">
                    <td className="px-4 py-3">{lead.participantName}</td>
                    <td className="px-4 py-3 font-mono text-brand-blue">
                      {lead.boothCode}
                    </td>
                    <td className="px-4 py-3 text-text-muted">
                      {format(new Date(lead.createdAt), "MM-dd HH:mm")}
                    </td>
                    <td className="px-4 py-3">
                      <CrmSyncStatusBadge status={lead.status} error={lead.error} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      {lead.status === "FAILED" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs"
                          onClick={() =>
                            retryMutation.mutate({ leadId: lead.id })
                          }
                        >
                          重试
                        </Button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </AdminContent>
    </>
  );

  if (embedded) return body;

  return <AdminPage>{body}</AdminPage>;
}
