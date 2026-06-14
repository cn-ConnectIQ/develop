"use client";

import { Fragment, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
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
import { toast } from "sonner";
import { AdminContent } from "@/components/admin/admin-header";
import { StatCard, StatGrid } from "@/components/admin/stat-card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

async function fetchConnections() {
  const res = await fetch("/api/platform/connections");
  if (!res.ok) throw new Error("加载失败");
  return (await res.json()).data;
}

const SOURCE_COLORS = ["#185FA5", "#534AB7", "#0F6E56", "#EF9F27"];

export function PlatformConnectionsClient() {
  const queryClient = useQueryClient();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["platform-connections"],
    queryFn: fetchConnections,
  });

  async function handleDelete() {
    if (!deleteId) return;
    const res = await fetch(`/api/platform/connections/${deleteId}`, {
      method: "DELETE",
    });
    if (res.ok) {
      toast.success("已强制断开连接");
      void queryClient.invalidateQueries({ queryKey: ["platform-connections"] });
    } else {
      toast.error("操作失败");
    }
    setDeleteId(null);
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
      <h1 className="mb-6 text-xl font-bold">连接管理</h1>

      <StatGrid columns={5}>
        <StatCard
          label="连接总数"
          value={data.health.total}
          accent="purple"
          className="[&_.admin-metric-num]:text-4xl"
        />
        <StatCard label="本月新增" value={data.health.monthlyNew} accent="blue" />
        <StatCard label="活跃连接率" value={`${data.health.activeRate}%`} accent="green" />
        <StatCard label="AI 推荐建立比例" value={`${data.health.aiRate}%`} accent="purple" />
        <StatCard label="平均关系深度" value={data.health.avgDepth} accent="blue" />
      </StatGrid>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="admin-card p-4">
          <h3 className="mb-4 text-sm font-semibold">来源趋势</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.sourceTrend}>
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line type="monotone" dataKey="扫码" stroke="#185FA5" />
                <Line type="monotone" dataKey="AI推荐" stroke="#534AB7" />
                <Line type="monotone" dataKey="SN" stroke="#0F6E56" />
                <Line type="monotone" dataKey="引荐" stroke="#EF9F27" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="admin-card p-4">
          <h3 className="mb-4 text-sm font-semibold">origin_context 分布</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.originContext}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={45}
                  outerRadius={80}
                  label
                >
                  {data.originContext.map((_: unknown, i: number) => (
                    <Cell key={i} fill={SOURCE_COLORS[i % SOURCE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="admin-card mt-6 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-[#fafaf8] text-left text-text-muted">
              <th className="px-4 py-3">用户 A</th>
              <th className="px-4 py-3">用户 B</th>
              <th className="px-4 py-3">来源</th>
              <th className="px-4 py-3">活动</th>
              <th className="px-4 py-3">深度</th>
              <th className="px-4 py-3">AI 分</th>
              <th className="px-4 py-3">时间</th>
              <th className="px-4 py-3">状态</th>
              <th className="px-4 py-3">操作</th>
            </tr>
          </thead>
          <tbody>
            {data.connections.map(
              (conn: {
                id: string;
                userA: { name: string; company: string };
                userB: { name: string; company: string };
                source: string;
                event: string;
                depth: number;
                aiScore: number;
                createdAt: string;
                status: string;
                interactions: Array<{ time: string; desc: string; type: string }>;
              }) => (
                <Fragment key={conn.id}>
                  <tr
                    className="h-14 cursor-pointer border-b border-border-light hover:bg-muted/30"
                    onClick={() =>
                      setExpandedId(expandedId === conn.id ? null : conn.id)
                    }
                  >
                    <td className="px-4">
                      <div className="flex items-center gap-2">
                        <Avatar className="size-7">
                          <AvatarFallback className="text-[10px]">
                            {conn.userA.name.slice(0, 1)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{conn.userA.name}</p>
                          <p className="text-xs text-text-muted">
                            {conn.userA.company}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4">
                      <p className="font-medium">{conn.userB.name}</p>
                      <p className="text-xs text-text-muted">{conn.userB.company}</p>
                    </td>
                    <td className="px-4">
                      <span className="rounded bg-brand-purple-light px-2 py-0.5 text-xs text-brand-purple">
                        {conn.source}
                      </span>
                    </td>
                    <td className="max-w-[120px] truncate px-4">{conn.event}</td>
                    <td className="px-4">
                      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-gray-100">
                        <div
                          className="h-full bg-brand-blue"
                          style={{ width: `${conn.depth * 20}%` }}
                        />
                      </div>
                    </td>
                    <td className="px-4 font-medium text-brand-purple">
                      {conn.aiScore}
                    </td>
                    <td className="px-4 text-text-muted">
                      {format(new Date(conn.createdAt), "M/d")}
                    </td>
                    <td className="px-4">
                      <span
                        className={cn(
                          "text-xs",
                          conn.status === "ACTIVE"
                            ? "text-brand-green"
                            : "text-text-muted",
                        )}
                      >
                        {conn.status === "ACTIVE" ? "活跃" : conn.status}
                      </span>
                    </td>
                    <td className="px-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-brand-red"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteId(conn.id);
                        }}
                      >
                        断开
                      </Button>
                    </td>
                  </tr>
                  {expandedId === conn.id && (
                    <tr>
                      <td colSpan={9} className="bg-[#fafaf8] px-8 py-4">
                        <p className="mb-2 text-xs font-semibold text-text-muted">
                          互动时间线
                        </p>
                        <ul className="space-y-2">
                          {conn.interactions.map((item, i) => (
                            <li key={i} className="flex gap-3 text-sm">
                              <span className="mt-1.5 size-2 shrink-0 rounded-full bg-brand-blue" />
                              <span className="text-text-muted">
                                {format(new Date(item.time), "HH:mm")}
                              </span>
                              <span>{item.desc}</span>
                            </li>
                          ))}
                        </ul>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ),
            )}
          </tbody>
        </table>
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>强制断开连接？</AlertDialogTitle>
            <AlertDialogDescription>
              此操作不可撤销，双方将无法再通过平台查看该连接记录。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-brand-red hover:bg-brand-red/90"
              onClick={() => void handleDelete()}
            >
              确认断开
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminContent>
  );
}
