"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { backgroundPoll } from "@/lib/query-options";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Plus, QrCode } from "lucide-react";
import { toast } from "sonner";
import {
  AdminContent,
  AdminHeader,
  AdminPage,
} from "@/components/admin/admin-header";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { BoothInteractionSheet } from "@/components/exhibitor/BoothInteractionSheet";
import {
  ExhibitorStatsCards,
  type ExhibitorDashboardStats,
} from "@/components/exhibitor/ExhibitorStatsCards";
import {
  RecommendedBuyerCard,
  type RecommendedBuyer,
} from "@/components/exhibitor/RecommendedBuyerCard";
import { InteractionQRDisplay } from "@/components/interactions/InteractionQRDisplay";
import { useRealtimeBoothLeads } from "@/hooks/useRealtimeBoothLeads";
import { cn } from "@/lib/utils";

type DashboardPayload = ExhibitorDashboardStats & {
  booth: {
    id: string;
    code: string;
    name: string;
    org_name: string;
    event_id: string;
    event_name: string;
    scan_url: string;
    qr_data_url: string;
  };
  hourly_trend: Array<{ hour: string; visitors: number; leads: number }>;
  live_interactions: Array<{
    session_id: string;
    title: string;
    kind: "poll" | "lottery";
    sub_type: string;
    participant_count: number;
    status: string;
  }>;
};

type LeadItem = {
  id: string;
  name: string;
  company: string | null;
  job_title: string | null;
  ai_intent_level: "A" | "B" | "C";
  intent_grade: string | null;
  status: string;
  created_at: string;
  crm_sync_status: string;
};

async function fetchDashboard(): Promise<DashboardPayload> {
  const res = await fetch("/api/exhibitor/dashboard-stats");
  if (!res.ok) throw new Error("加载失败");
  return (await res.json()).data;
}

async function fetchBuyers(): Promise<RecommendedBuyer[]> {
  const res = await fetch("/api/exhibitor/recommended-buyers");
  if (!res.ok) throw new Error("加载失败");
  return (await res.json()).data.buyers;
}

async function fetchLeads(): Promise<LeadItem[]> {
  const res = await fetch("/api/exhibitor/leads?limit=8");
  if (!res.ok) throw new Error("加载失败");
  return (await res.json()).data.leads;
}

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function gradeBadge(level: "A" | "B" | "C") {
  const styles = {
    A: "bg-brand-red-light text-brand-red",
    B: "bg-brand-blue-light text-brand-blue",
    C: "bg-border-light text-text-muted",
  };
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[10px] font-semibold",
        styles[level],
      )}
    >
      {level} 级
    </span>
  );
}

export function ExhibitorDashboardClient() {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);

  const refreshAll = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["exhibitor-dashboard"] });
    void queryClient.invalidateQueries({ queryKey: ["exhibitor-buyers"] });
    void queryClient.invalidateQueries({ queryKey: ["exhibitor-leads"] });
  }, [queryClient]);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["exhibitor-dashboard"],
    queryFn: fetchDashboard,
    ...backgroundPoll(30_000),
  });

  const { data: buyers = [] } = useQuery({
    queryKey: ["exhibitor-buyers"],
    queryFn: fetchBuyers,
    ...backgroundPoll(30_000),
  });

  const { data: leads = [] } = useQuery({
    queryKey: ["exhibitor-leads"],
    queryFn: fetchLeads,
    ...backgroundPoll(30_000),
  });

  useRealtimeBoothLeads({
    boothId: data?.booth.id ?? "",
    onUpdate: refreshAll,
    enabled: Boolean(data?.booth.id),
  });

  const gradePatch = useMutation({
    mutationFn: async ({
      leadId,
      grade,
    }: {
      leadId: string;
      grade: "A" | "B" | "C";
    }) => {
      const res = await fetch(`/api/exhibitor/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intent_grade: grade }),
      });
      if (!res.ok) throw new Error("更新失败");
    },
    onSuccess: () => {
      toast.success("评级已更新");
      refreshAll();
    },
    onError: () => toast.error("评级更新失败"),
  });

  if (isLoading) {
    return (
      <AdminContent>
        <div className="py-20 text-center text-sm text-text-muted">加载中…</div>
      </AdminContent>
    );
  }

  if (isError || !data) {
    return (
      <AdminContent>
        <div className="admin-card mx-auto max-w-lg p-8 text-center">
          <p className="font-semibold">无法加载展商工作台</p>
          <button
            type="button"
            className="mt-4 text-sm text-brand-amber hover:underline"
            onClick={() => void refetch()}
          >
            重试
          </button>
        </div>
      </AdminContent>
    );
  }

  const booth = data.booth;

  return (
    <AdminPage>
      <AdminHeader
        title={`${booth.org_name} · ${booth.code}`}
        description={booth.event_name}
        breadcrumb={["展商工作台"]}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              className="border-brand-amber text-brand-amber hover:bg-brand-amber-light"
              onClick={() => setQrOpen(true)}
            >
              <QrCode className="mr-1 size-4" />
              我的展位码
            </Button>
            <Link
              href={`/exhibitor/booths/${booth.id}/interactions`}
              className="inline-flex h-9 items-center justify-center rounded-md bg-brand-amber px-4 text-sm font-medium text-white hover:bg-brand-amber/90"
            >
              展位互动
            </Link>
          </div>
        }
      />

      <AdminContent>
        <ExhibitorStatsCards stats={data} />

        <section className="admin-card mt-6 p-5">
          <h2 className="font-semibold text-brand-purple">
            🎯 AI 为你推荐的高意向买家
          </h2>
          <p className="mt-1 text-sm text-text-muted">
            基于展位行为信号，AI 识别高价值参会者并主动撮合
          </p>
          <div className="mt-4 space-y-3">
            {buyers.length === 0 ? (
              <p className="py-6 text-center text-sm text-text-muted">
                暂无推荐买家，请确保访客正在扫码互动
              </p>
            ) : (
              buyers.map((buyer) => (
                <RecommendedBuyerCard
                  key={buyer.buyer_user_id}
                  buyer={buyer}
                  eventId={booth.event_id}
                  boothId={booth.id}
                />
              ))
            )}
          </div>
        </section>

        <section className="admin-card mt-6 p-5">
          <div className="flex items-center justify-between gap-4">
            <h2 className="font-semibold text-brand-green">最近采集的线索</h2>
            <Link
              href={`/exhibitor/booths/${booth.id}/leads`}
              className="text-sm text-brand-green hover:underline"
            >
              查看全部 →
            </Link>
          </div>
          <ul className="mt-4 divide-y divide-border-light">
            {leads.map((lead) => (
              <li
                key={lead.id}
                className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{lead.name}</p>
                  <p className="text-sm text-text-muted">
                    {[lead.company, lead.job_title].filter(Boolean).join(" · ") ||
                      "—"}
                  </p>
                </div>
                <select
                  className="h-8 rounded-lg border border-border-light bg-white px-2 text-xs"
                  value={lead.intent_grade ?? lead.ai_intent_level}
                  onChange={(e) =>
                    gradePatch.mutate({
                      leadId: lead.id,
                      grade: e.target.value as "A" | "B" | "C",
                    })
                  }
                >
                  <option value="A">A 级</option>
                  <option value="B">B 级</option>
                  <option value="C">C 级</option>
                </select>
                {gradeBadge(lead.ai_intent_level)}
                <span className="text-xs text-text-muted">
                  {formatTime(lead.created_at)}
                </span>
              </li>
            ))}
            {leads.length === 0 && (
              <li className="py-8 text-center text-sm text-text-muted">
                暂无线索，访客留资后将在此展示
              </li>
            )}
          </ul>
          {leads.length > 0 && (
            <div className="mt-4 border-t border-border-light pt-4">
              <Link
                href={`/exhibitor/booths/${booth.id}/leads#export`}
                className="inline-flex h-8 items-center rounded-md border border-border-light px-3 text-sm font-medium hover:bg-gray-50"
              >
                导出到 MarketUP
              </Link>
            </div>
          )}
        </section>

        <section className="admin-card mt-6 p-5">
          <div className="flex items-center justify-between gap-4">
            <h2 className="font-semibold">我的展位互动</h2>
            <Button
              size="sm"
              className="bg-brand-amber text-white hover:bg-brand-amber/90"
              onClick={() => setCreateOpen(true)}
            >
              <Plus className="mr-1 size-4" />
              发起互动
            </Button>
          </div>
          <div className="mt-4 space-y-3">
            {data.live_interactions.length === 0 ? (
              <p className="text-sm text-text-muted">暂无进行中的互动</p>
            ) : (
              data.live_interactions.map((item) => (
                <Link
                  key={item.session_id}
                  href={`/exhibitor/booths/${booth.id}/interactions`}
                  className="flex items-center justify-between rounded-xl border border-border-light bg-white p-4 transition-colors hover:border-brand-amber/40"
                >
                  <div>
                    <p className="font-medium">{item.title}</p>
                    <p className="text-sm text-text-muted">
                      {item.kind === "poll" ? "投票" : "抽奖"} · 进行中
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="size-2 rounded-full bg-brand-green" />
                    <span className="text-sm font-medium text-brand-green">
                      {item.participant_count} 人参与
                    </span>
                  </div>
                </Link>
              ))
            )}
          </div>
        </section>

        <section className="admin-card mt-6 p-5">
          <h2 className="mb-4 font-semibold">展位数据趋势</h2>
          <p className="mb-4 text-sm text-text-muted">
            今日各时段访客与线索走势，帮你判断人流高峰
          </p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={data.hourly_trend}
                margin={{ top: 4, right: 8, left: -16, bottom: 0 }}
              >
                <XAxis
                  dataKey="hour"
                  tick={{ fontSize: 11, fill: "#5F5E5A" }}
                  axisLine={false}
                  tickLine={false}
                  interval={2}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "#5F5E5A" }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: 8,
                    border: "1px solid #D3D1C7",
                    fontSize: 12,
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="visitors"
                  name="访客"
                  stroke="#EF9F27"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="leads"
                  name="线索"
                  stroke="#0F6E56"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      </AdminContent>

      <BoothInteractionSheet
        boothId={booth.id}
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSuccess={refreshAll}
      />

      <Sheet open={qrOpen} onOpenChange={setQrOpen}>
        <SheetContent className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>展位码 · {booth.code}</SheetTitle>
          </SheetHeader>
          <p className="mt-2 text-sm text-text-muted">
            参会者扫码即可到访 {booth.name} 并触发行为信号
          </p>
          <div className="mt-6 flex justify-center">
            <InteractionQRDisplay
              sessionCode={booth.code}
              qrUrl={booth.qr_data_url}
              interactionTitle={`${booth.org_name} · ${booth.code}`}
            />
          </div>
          <p className="mt-3 text-center text-xs text-text-muted">
            {booth.scan_url}
          </p>
        </SheetContent>
      </Sheet>
    </AdminPage>
  );
}
