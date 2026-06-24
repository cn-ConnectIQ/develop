"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
import { Download, RefreshCw, Store, Users } from "lucide-react";
import { toast } from "sonner";
import {
  AdminContent,
  AdminHeader,
  AdminPage,
} from "@/components/admin/admin-header";
import { StatCard, StatGrid } from "@/components/admin/stat-card";
import { Button } from "@/components/ui/button";
import type { EventConnectionAnalytics } from "@/lib/connection-analytics-service";

const SOURCE_COLORS = ["#185FA5", "#534AB7", "#0F6E56", "#EF9F27", "#854F0B"];

async function fetchAnalytics(eventId: string): Promise<EventConnectionAnalytics> {
  const res = await fetch(`/api/events/${eventId}/connection-analytics`);
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json.message ?? "加载失败");
  }
  return (await res.json()).data;
}

async function downloadConnectionsCsv(eventId: string) {
  const res = await fetch(
    `/api/events/${eventId}/connection-analytics?export=csv`,
  );
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json.message ?? "导出失败");
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `connections-${eventId}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function ConnectionsAnalyticsClient({ eventId }: { eventId: string }) {
  const [exporting, setExporting] = useState(false);

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["connection-analytics", eventId],
    queryFn: () => fetchAnalytics(eventId),
  });

  async function handleExport() {
    setExporting(true);
    try {
      await downloadConnectionsCsv(eventId);
      toast.success("连接数据已导出");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "导出失败");
    } finally {
      setExporting(false);
    }
  }

  if (isLoading) {
    return (
      <AdminPage>
        <AdminContent>
          <div className="py-20 text-center text-sm text-text-muted">加载中…</div>
        </AdminContent>
      </AdminPage>
    );
  }

  if (isError || !data) {
    return (
      <AdminPage>
        <AdminHeader title="连接数据分析" breadcrumb={["活动", "连接数据分析"]} />
        <AdminContent>
          <div className="rounded-xl border border-border-light bg-white py-16 text-center">
            <p className="text-sm text-brand-red">
              {error instanceof Error ? error.message : "加载失败"}
            </p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => void refetch()}
            >
              <RefreshCw className="mr-1 size-4" />
              重试
            </Button>
          </div>
        </AdminContent>
      </AdminPage>
    );
  }

  const { summary } = data;

  return (
    <AdminPage>
      <AdminHeader
        title="连接数据分析"
        description="活动现场商业连接效果与 ROI 分析（HANDOFF-06 · B 端数据，非社交 CRM）"
        breadcrumb={["活动", "连接数据分析"]}
        actions={
          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={isFetching}
              onClick={() => void refetch()}
            >
              <RefreshCw
                className={`mr-1 size-4 ${isFetching ? "animate-spin" : ""}`}
              />
              刷新
            </Button>
            <Button variant="outline" disabled={exporting} onClick={() => void handleExport()}>
              <Download className="mr-2 size-4" />
              {exporting ? "导出中…" : "导出连接数据"}
            </Button>
          </div>
        }
      />

      <AdminContent>
        <StatGrid columns={4}>
          <StatCard
            label="总连接数"
            value={summary.totalConnections}
            accent="blue"
          />
          <StatCard
            label="微信交换率"
            value={`${summary.wechatExchangeRate}%`}
            hint={`${summary.wechatExchangedCount} 个已交换微信`}
            accent="green"
          />
          <StatCard
            label="AI 促成连接"
            value={summary.aiMatchConnections}
            hint="体现 AI 推荐价值"
            accent="purple"
          />
          <StatCard
            label="人均连接数"
            value={summary.avgConnectionsPerCheckin}
            hint={`签到 ${summary.checkinCount} 人`}
            accent="blue"
          />
        </StatGrid>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <div className="admin-card p-4">
            <h3 className="mb-4 text-sm font-semibold">连接趋势（按小时）</h3>
            <p className="mb-3 text-xs text-text-muted">
              观察茶歇、午餐等时段的社交活跃峰值
            </p>
            <div className="h-64">
              {data.hourlyTrend.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.hourlyTrend}>
                    <XAxis dataKey="hour" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="count"
                      name="新增连接"
                      stroke="#185FA5"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-text-muted">
                  暂无连接数据
                </div>
              )}
            </div>
          </div>

          <div className="admin-card p-4">
            <h3 className="mb-4 text-sm font-semibold">连接来源分布</h3>
            <p className="mb-3 text-xs text-text-muted">
              各功能模块对现场连接的贡献占比
            </p>
            <div className="h-64">
              {data.sourceBreakdown.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data.sourceBreakdown}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={50}
                      outerRadius={85}
                      label={({ name, percent }) =>
                        `${name} ${((percent ?? 0) * 100).toFixed(0)}%`
                      }
                    >
                      {data.sourceBreakdown.map((_, i) => (
                        <Cell
                          key={i}
                          fill={SOURCE_COLORS[i % SOURCE_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-text-muted">
                  暂无来源数据
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="admin-card mt-6 overflow-hidden">
          <div className="flex items-center gap-2 border-b px-4 py-3">
            <Users className="size-4 text-brand-blue" />
            <h3 className="text-sm font-semibold">最活跃连接者 TOP 10</h3>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-[#fafaf8] text-left text-text-muted">
                <th className="px-4 py-3">排名</th>
                <th className="px-4 py-3">参会者</th>
                <th className="px-4 py-3">公司</th>
                <th className="px-4 py-3">建立连接数</th>
                <th className="px-4 py-3">微信交换数</th>
              </tr>
            </thead>
            <tbody>
              {data.topConnectors.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-text-muted">
                    暂无连接记录
                  </td>
                </tr>
              ) : (
                data.topConnectors.map((row) => (
                  <tr key={row.userId} className="border-b last:border-0">
                    <td className="px-4 py-3 font-medium">{row.rank}</td>
                    <td className="px-4 py-3">{row.name}</td>
                    <td className="px-4 py-3 text-text-muted">{row.company}</td>
                    <td className="px-4 py-3">{row.connectionCount}</td>
                    <td className="px-4 py-3 text-brand-green">
                      {row.wechatExchangeCount}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="admin-card mt-6 overflow-hidden">
          <div className="flex items-center gap-2 border-b px-4 py-3">
            <Store className="size-4 text-brand-purple" />
            <h3 className="text-sm font-semibold">展位连接排行</h3>
          </div>
          <p className="px-4 pt-3 text-xs text-text-muted">
            哪些展位不仅采集线索，还促成了参会者之间的社交连接
          </p>
          <table className="mt-2 w-full text-sm">
            <thead>
              <tr className="border-b bg-[#fafaf8] text-left text-text-muted">
                <th className="px-4 py-3">展位</th>
                <th className="px-4 py-3">展商</th>
                <th className="px-4 py-3">促成连接数</th>
              </tr>
            </thead>
            <tbody>
              {data.boothRankings.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-text-muted">
                    暂无展位连接数据（展会场景下展位扫码连接会出现在此）
                  </td>
                </tr>
              ) : (
                data.boothRankings.map((row) => (
                  <tr key={row.boothId} className="border-b last:border-0">
                    <td className="px-4 py-3 font-medium">{row.boothCode}</td>
                    <td className="px-4 py-3">{row.companyName}</td>
                    <td className="px-4 py-3">{row.connectionCount}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <p className="mt-6 text-center text-xs text-text-tertiary">
          连接信息仅在本次活动范围内统计，导出 CSV 可用于主办方复盘或导入 MarketUP
        </p>
      </AdminContent>
    </AdminPage>
  );
}
