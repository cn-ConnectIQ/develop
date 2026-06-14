"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import {
  Area,
  AreaChart,
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
import { Bot, Download, Link2, Share2, Star } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AdminContent } from "@/components/admin/admin-header";
import { StatCard, StatGrid } from "@/components/admin/stat-card";
import { cn } from "@/lib/utils";

const PURPLE = "#534AB7";
const BLUE = "#185FA5";
const GREEN = "#0F6E56";
const SOURCE_COLORS = ["#185FA5", "#534AB7", "#0F6E56", "#EF9F27"];

const ALL_TABS = [
  "connections",
  "checkin",
  "interactions",
  "booths",
  "matching",
  "meetings",
] as const;

async function fetchReport(eventId: string) {
  const res = await fetch(`/api/events/${eventId}/reports/summary`);
  if (!res.ok) throw new Error("加载报告失败");
  return (await res.json()).data;
}

export function ReportsPageClient({ eventId }: { eventId: string }) {
  const [activeTab, setActiveTab] = useState("connections");
  const [showAbsent, setShowAbsent] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["event-report", eventId],
    queryFn: () => fetchReport(eventId),
  });

  if (isLoading || !data) {
    return (
      <AdminContent>
        <div className="py-20 text-center text-sm text-text-muted">
          加载报告数据...
        </div>
      </AdminContent>
    );
  }

  const { event, aiSummary, connections, checkin, interactions, booths, matching, meetings } =
    data;

  function handleExport(format: "pdf" | "excel") {
    void (async () => {
      try {
        const res = await fetch(`/api/events/${eventId}/reports/export`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ format, tabs: [...ALL_TABS] }),
        });
        if (!res.ok) {
          toast.error("导出失败");
          return;
        }
        const blob = await res.blob();
        const disposition = res.headers.get("Content-Disposition") ?? "";
        const match = disposition.match(/filename="([^"]+)"/);
        const filename = match?.[1]
          ? decodeURIComponent(match[1])
          : `report.${format === "excel" ? "xlsx" : "html"}`;
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        toast.success(
          format === "pdf"
            ? "报告已下载，可用浏览器打开后打印为 PDF"
            : "Excel 已下载",
        );
      } catch {
        toast.error("导出失败");
      }
    })();
  }

  function handleShare() {
    void (async () => {
      try {
        const res = await fetch(`/api/events/${eventId}/reports/export`, {
          method: "PUT",
        });
        const json = await res.json();
        if (!res.ok) {
          toast.error(json.error ?? "生成分享链接失败");
          return;
        }
        const url = json.data.shareUrl as string;
        await navigator.clipboard.writeText(url);
        toast.success("分享链接已复制（7 天有效）");
      } catch {
        toast.error("生成分享链接失败");
      }
    })();
  }

  return (
    <AdminContent>
      <div className="admin-card mb-6 flex flex-wrap items-start justify-between gap-4 p-6">
        <div>
          <h1 className="text-xl font-bold">{event.name}</h1>
          <p className="mt-1 text-sm text-text-muted">
            {event.startDate &&
              format(new Date(event.startDate), "yyyy年M月d日", { locale: zhCN })}
            {event.location && ` · ${event.location}`}
          </p>
          <span className="mt-2 inline-block rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-text-muted">
            {event.phase === "ended" ? "已结束" : "进行中"}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            className="bg-brand-blue hover:bg-brand-blue/90"
            onClick={() => handleExport("pdf")}
          >
            <Download className="mr-1 size-4" />
            导出 PDF
          </Button>
          <Button variant="outline" onClick={() => handleExport("excel")}>
            导出 Excel（原始数据）
          </Button>
          <Button variant="outline" onClick={handleShare}>
            <Share2 className="mr-1 size-4" />
            分享链接（7 天有效）
          </Button>
        </div>
      </div>

      <div className="mb-6 flex items-center gap-3 rounded-xl bg-brand-blue-light p-4">
        <Bot className="size-5 shrink-0 text-brand-blue" />
        <p className="text-sm text-brand-blue">{aiSummary}</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6 flex h-auto flex-wrap gap-1 bg-transparent p-0">
          {[
            { id: "connections", label: "连接报告" },
            { id: "checkin", label: "签到报告" },
            { id: "interactions", label: "互动报告" },
            { id: "booths", label: "展位报告" },
            { id: "matching", label: "配对报告" },
            { id: "meetings", label: "会面报告" },
          ].map((tab) => (
            <TabsTrigger
              key={tab.id}
              value={tab.id}
              className={cn(
                "rounded-lg border px-4 py-2 data-[state=active]:border-brand-purple data-[state=active]:bg-brand-purple-light data-[state=active]:text-brand-purple",
              )}
            >
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="connections" className="space-y-6">
          <StatGrid>
            <StatCard
              label="商业连接总数"
              value={connections.total}
              accent="purple"
              className="[&_.admin-metric-num]:text-4xl"
            />
            <StatCard
              label="人均连接"
              value={`${connections.avgPerPerson} 个`}
              accent="purple"
            />
            <StatCard
              label="买卖双方连接"
              value={`${connections.buyerSellerPairs} 对（${connections.buyerSellerRate}%）`}
              accent="purple"
            />
            <StatCard
              label="较历史对比"
              value={connections.vsHistory}
              accent="green"
              trend={{ value: connections.vsHistory, positive: true }}
            />
          </StatGrid>

          <div className="grid gap-4 lg:grid-cols-5">
            <div className="admin-card p-4 lg:col-span-3">
              <h3 className="mb-4 text-sm font-semibold">连接累计增长</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={connections.timeline}>
                    <XAxis dataKey="hour" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Area
                      type="monotone"
                      dataKey="total"
                      stroke={BLUE}
                      fill={BLUE}
                      fillOpacity={0.2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="admin-card p-4 lg:col-span-2">
              <h3 className="mb-4 text-sm font-semibold">连接来源分布</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={connections.sources}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={({ name, percent }) =>
                        `${name} ${((percent ?? 0) * 100).toFixed(0)}%`
                      }
                    >
                      {connections.sources.map((_: unknown, i: number) => (
                        <Cell
                          key={i}
                          fill={SOURCE_COLORS[i % SOURCE_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="admin-card p-4">
            <h3 className="mb-4 text-sm font-semibold">Top 10 连接节点</h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-text-muted">
                  <th className="pb-2 pr-4">排名</th>
                  <th className="pb-2 pr-4">参会者</th>
                  <th className="pb-2 pr-4">连接数</th>
                  <th className="pb-2">主要来源</th>
                </tr>
              </thead>
              <tbody>
                {connections.topNodes.map(
                  (node: {
                    rank: number;
                    name: string;
                    company: string;
                    connections: number;
                    source: string;
                    avatarInitial: string;
                  }) => (
                    <tr key={node.rank} className="border-b border-border-light">
                      <td className="py-3 pr-4">{node.rank}</td>
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-2">
                          <Avatar className="size-8">
                            <AvatarFallback className="bg-brand-purple-light text-xs text-brand-purple">
                              {node.avatarInitial}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{node.name}</p>
                            <p className="text-xs text-text-muted">
                              {node.company}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 pr-4 font-medium text-brand-blue">
                        {node.connections}
                      </td>
                      <td className="py-3">{node.source}</td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="checkin" className="space-y-6">
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="admin-card flex flex-col items-center p-6">
              <h3 className="mb-4 self-start text-sm font-semibold">到场率</h3>
              <div className="relative flex size-48 items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[
                        { name: "已签到", value: checkin.total },
                        {
                          name: "未签到",
                          value: Math.max(checkin.participants - checkin.total, 0),
                        },
                      ]}
                      dataKey="value"
                      innerRadius={60}
                      outerRadius={80}
                      startAngle={90}
                      endAngle={-270}
                    >
                      <Cell fill={GREEN} />
                      <Cell fill="#E5E7EB" />
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute text-center">
                  <p className="text-3xl font-bold text-brand-green">
                    {checkin.rate}%
                  </p>
                  <p className="text-xs text-text-muted">到场率</p>
                </div>
              </div>
            </div>
            <div className="admin-card p-4">
              <h3 className="mb-4 text-sm font-semibold">签到时间分布</h3>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={checkin.byHour}>
                    <XAxis dataKey="hour" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="count" fill={GREEN} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <StatGrid columns={2}>
            <StatCard
              label="VIP 到场率"
              value={`${checkin.vipRate}%`}
              accent="amber"
              className="[&_.admin-metric-num]:text-4xl [&_.admin-metric-num]:text-brand-gold"
            />
            <StatCard
              label="签到总数"
              value={`${checkin.total} / ${checkin.participants}`}
              accent="green"
            />
          </StatGrid>

          <div className="admin-card p-4">
            <button
              type="button"
              className="flex w-full items-center justify-between text-sm font-semibold"
              onClick={() => setShowAbsent((v) => !v)}
            >
              未到场名单（{checkin.absent.length} 人）
              <span className="text-text-muted">{showAbsent ? "收起" : "展开"}</span>
            </button>
            {showAbsent && (
              <ul className="mt-3 space-y-2 text-sm">
                {checkin.absent.map(
                  (p: { name: string; company: string | null; email: string | null }) => (
                    <li
                      key={p.email ?? p.name}
                      className="flex justify-between border-b border-border-light py-2"
                    >
                      <span>
                        {p.name}
                        {p.company && (
                          <span className="ml-2 text-text-muted">{p.company}</span>
                        )}
                      </span>
                      <span className="text-text-muted">{p.email}</span>
                    </li>
                  ),
                )}
              </ul>
            )}
          </div>
        </TabsContent>

        <TabsContent value="interactions" className="space-y-6">
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="admin-card p-5">
              <p className="text-[13px] font-medium text-text-muted">满意度均分</p>
              <p className="admin-metric-num mt-3 text-4xl font-bold text-brand-amber">
                {interactions.satisfaction}
              </p>
              <StarRating score={interactions.satisfaction} />
            </div>
            <StatCard
              label="互动总参与"
              value={interactions.totalResponses}
              accent="blue"
            />
            <StatCard
              label="投票/互动场次"
              value={interactions.polls.length}
              accent="purple"
            />
          </div>

          <div className="admin-card p-4">
            <h3 className="mb-4 text-sm font-semibold">各互动参与率</h3>
            <div className="space-y-3">
              {interactions.polls.map(
                (poll: { id: string; title: string; rate: number; responses: number }) => (
                  <div key={poll.id}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span className="truncate pr-4">{poll.title}</span>
                      <span className="shrink-0 text-text-muted">
                        {poll.rate}% · {poll.responses} 人
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                      <div
                        className="h-full rounded-full bg-brand-blue"
                        style={{ width: `${Math.min(poll.rate, 100)}%` }}
                      />
                    </div>
                  </div>
                ),
              )}
              {interactions.polls.length === 0 && (
                <p className="text-sm text-text-muted">暂无互动数据</p>
              )}
            </div>
          </div>

          <div className="admin-card p-4">
            <h3 className="mb-4 text-sm font-semibold">Q&A 热度 Top 10</h3>
            <ol className="space-y-2 text-sm">
              {interactions.topQuestions.map(
                (q: { rank: number; question: string; votes: number }) => (
                  <li key={q.rank} className="flex gap-3">
                    <span className="font-bold text-brand-purple">{q.rank}</span>
                    <span className="flex-1">{q.question}</span>
                    <span className="text-text-muted">{q.votes} 票</span>
                  </li>
                ),
              )}
            </ol>
          </div>
        </TabsContent>

        <TabsContent value="booths" className="space-y-6">
          <div className="admin-card p-4">
            <h3 className="mb-4 text-sm font-semibold">各展商线索数</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={booths.exhibitors}
                  layout="vertical"
                  margin={{ left: 80 }}
                >
                  <XAxis type="number" />
                  <YAxis
                    type="category"
                    dataKey="code"
                    width={70}
                    tick={{ fontSize: 11 }}
                  />
                  <Tooltip />
                  <Bar dataKey="leads" fill={BLUE} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="admin-card p-4">
            <h3 className="mb-4 text-sm font-semibold">意向分布（A/B/C 堆叠）</h3>
            <div className="h-12">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={[
                    {
                      name: "全部线索",
                      A: booths.intentDistribution.A,
                      B: booths.intentDistribution.B,
                      C: booths.intentDistribution.C,
                    },
                  ]}
                  layout="vertical"
                  stackOffset="expand"
                >
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="name" hide />
                  <Tooltip
                    formatter={(value, name) => [
                      value ?? 0,
                      `${String(name)} 级`,
                    ]}
                  />
                  <Bar dataKey="A" stackId="a" fill="#A32D2D" radius={[4, 0, 0, 4]} />
                  <Bar dataKey="B" stackId="a" fill={BLUE} />
                  <Bar
                    dataKey="C"
                    stackId="a"
                    fill="#9CA3AF"
                    radius={[0, 4, 4, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 flex gap-4 text-xs text-text-muted">
              <span className="flex items-center gap-1">
                <span className="size-2 rounded bg-[#A32D2D]" />A 级{" "}
                {booths.intentDistribution.A}
              </span>
              <span className="flex items-center gap-1">
                <span className="size-2 rounded bg-brand-blue" />B 级{" "}
                {booths.intentDistribution.B}
              </span>
              <span className="flex items-center gap-1">
                <span className="size-2 rounded bg-gray-400" />C 级{" "}
                {booths.intentDistribution.C}
              </span>
            </div>
          </div>

          <div className="admin-card p-4">
            <h3 className="mb-2 text-sm font-semibold">MarketUP 同步率汇总</h3>
            <p className="mb-4 text-3xl font-bold text-brand-green">
              {booths.marketupSyncRate}%
            </p>
            {booths.syncSummary?.length > 0 ? (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-text-muted">
                    <th className="pb-2 pr-4">展位</th>
                    <th className="pb-2 pr-4">线索数</th>
                    <th className="pb-2 pr-4">已同步</th>
                    <th className="pb-2">同步率</th>
                  </tr>
                </thead>
                <tbody>
                  {booths.syncSummary.map(
                    (row: {
                      boothCode: string;
                      boothName: string;
                      total: number;
                      synced: number;
                      rate: number;
                    }) => (
                      <tr
                        key={row.boothCode}
                        className="border-b border-border-light"
                      >
                        <td className="py-2 pr-4">
                          {row.boothCode} · {row.boothName}
                        </td>
                        <td className="py-2 pr-4">{row.total}</td>
                        <td className="py-2 pr-4">{row.synced}</td>
                        <td className="py-2">{row.rate}%</td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            ) : (
              <p className="text-xs text-text-muted">暂无同步数据</p>
            )}
          </div>
        </TabsContent>

        <TabsContent value="matching" className="space-y-6">
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="admin-card flex flex-col items-center p-6">
              <h3 className="mb-4 self-start text-sm font-semibold">参与率</h3>
              <div className="relative flex size-36 items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[
                        { name: "已参与", value: matching.participationRate },
                        {
                          name: "未参与",
                          value: 100 - matching.participationRate,
                        },
                      ]}
                      dataKey="value"
                      innerRadius={48}
                      outerRadius={64}
                      startAngle={90}
                      endAngle={-270}
                    >
                      <Cell fill={PURPLE} />
                      <Cell fill="#E5E7EB" />
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute text-center">
                  <p className="text-2xl font-bold text-brand-purple">
                    {matching.participationRate}%
                  </p>
                </div>
              </div>
            </div>
            <StatCard
              label="配对完成率"
              value={`${matching.completionRate}%`}
              accent="purple"
              className="[&_.admin-metric-num]:text-4xl"
            />
            <StatCard
              label="建立连接数"
              value={matching.connectionsMade}
              accent="purple"
              className="[&_.admin-metric-num]:text-4xl"
            />
          </div>

          <div className="admin-card overflow-x-auto p-4">
            <h3 className="mb-4 text-sm font-semibold">配对明细</h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-text-muted">
                  <th className="pb-2 pr-4">配对</th>
                  <th className="pb-2 pr-4">配对分</th>
                  <th className="pb-2 pr-4">双方评分</th>
                  <th className="pb-2">建立连接</th>
                </tr>
              </thead>
              <tbody>
                {matching.pairs.map(
                  (
                    pair: {
                      userA: string;
                      userB: string;
                      score: number;
                      ratingA: number;
                      ratingB: number;
                      connected: boolean;
                    },
                    i: number,
                  ) => (
                    <tr key={i} className="border-b border-border-light">
                      <td className="py-3 pr-4">
                        {pair.userA} ↔ {pair.userB}
                      </td>
                      <td className="py-3 pr-4 font-medium text-brand-purple">
                        {pair.score}
                      </td>
                      <td className="py-3 pr-4">
                        {pair.ratingA} / {pair.ratingB}
                      </td>
                      <td className="py-3">
                        {pair.connected ? (
                          <span className="text-brand-green">是</span>
                        ) : (
                          <span className="text-text-muted">否</span>
                        )}
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="meetings" className="space-y-6">
          <StatCard
            label="AI 推荐时间段采纳率"
            value={`${meetings.aiSlotAdoption}%`}
            accent="purple"
            className="max-w-sm [&_.admin-metric-num]:text-4xl"
          />

          <div className="admin-card p-4">
            <h3 className="mb-4 text-sm font-semibold">预约转化漏斗</h3>
            <div className="flex flex-wrap items-end gap-2">
              {meetings.funnel.map(
                (stage: { stage: string; count: number }, i: number) => (
                  <div key={stage.stage} className="flex items-center gap-2">
                    <div
                      className="flex flex-col items-center rounded-lg bg-brand-purple-light px-4 py-3"
                      style={{ opacity: 1 - i * 0.12 }}
                    >
                      <p className="text-2xl font-bold text-brand-purple">
                        {stage.count}
                      </p>
                      <p className="text-xs text-text-muted">{stage.stage}</p>
                    </div>
                    {i < meetings.funnel.length - 1 && (
                      <Link2 className="size-4 text-text-tertiary" />
                    )}
                  </div>
                ),
              )}
            </div>
          </div>

          <div className="admin-card p-4">
            <h3 className="mb-4 text-sm font-semibold">会面评分分布</h3>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={meetings.ratingDistribution}>
                  <XAxis dataKey="score" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="left" name="用户 A" fill={PURPLE} />
                  <Bar dataKey="right" name="用户 B" fill={BLUE} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </AdminContent>
  );
}

function StarRating({ score }: { score: number }) {
  return (
    <div className="mt-2 flex gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          className={cn(
            "size-5",
            i < Math.round(score)
              ? "fill-brand-amber text-brand-amber"
              : "text-gray-200",
          )}
        />
      ))}
    </div>
  );
}
