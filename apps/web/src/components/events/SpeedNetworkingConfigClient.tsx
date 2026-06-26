"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Handshake, Monitor, Play, Plus, Square, XCircle } from "lucide-react";
import { toast } from "sonner";
import {
  AdminContent,
  AdminHeader,
  AdminPage,
  SectionCard,
} from "@/components/admin/admin-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

type SnSessionRow = {
  id: string;
  event_id: string;
  status: "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  round_count: number;
  pair_count: number;
  connection_count: number;
  participant_count: number;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
};

const STATUS_META: Record<
  SnSessionRow["status"],
  { label: string; className: string }
> = {
  SCHEDULED: {
    label: "待开始",
    className: "bg-brand-blue-light text-brand-blue",
  },
  IN_PROGRESS: {
    label: "进行中",
    className: "bg-brand-green-light text-brand-green",
  },
  COMPLETED: {
    label: "已结束",
    className: "bg-gray-100 text-text-muted",
  },
  CANCELLED: {
    label: "已取消",
    className: "bg-brand-red-light text-brand-red",
  },
};

async function fetchSessions(eventId: string): Promise<SnSessionRow[]> {
  const res = await fetch(`/api/events/${eventId}/sn-sessions`);
  if (!res.ok) throw new Error("加载失败");
  return (await res.json()).data;
}

export function SpeedNetworkingConfigClient({ eventId }: { eventId: string }) {
  const queryClient = useQueryClient();
  const [roundCount, setRoundCount] = useState(3);

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ["sn-sessions", eventId],
    queryFn: () => fetchSessions(eventId),
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/events/${eventId}/sn-sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ round_count: roundCount }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? "创建失败");
      }
      return (await res.json()).data as SnSessionRow;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["sn-sessions", eventId] });
      toast.success("SN 场次已创建");
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "创建失败"),
  });

  const statusMutation = useMutation({
    mutationFn: async ({
      sessionId,
      status,
    }: {
      sessionId: string;
      status: SnSessionRow["status"];
    }) => {
      const res = await fetch(
        `/api/events/${eventId}/sn-sessions/${sessionId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        },
      );
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? "操作失败");
      }
      return (await res.json()).data as SnSessionRow;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["sn-sessions", eventId] });
      toast.success("场次状态已更新");
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "操作失败"),
  });

  const hasActive = sessions.some(
    (s) => s.status === "SCHEDULED" || s.status === "IN_PROGRESS",
  );

  return (
    <AdminPage>
      <AdminHeader
        title="Speed Networking 配置"
        description="管理快速配对场次：创建、启停轮次，参会者可在小程序参与"
        breadcrumb={["活动", "Speed Networking"]}
      />
      <AdminContent className="space-y-6">
        <SectionCard title="快捷操作">
          <p className="text-sm text-text-muted">
            开启后，参会者可在小程序参与 Speed Networking 轮次，连接来源将标记为
            SN。现场可通过互动大屏查看连接热力。
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href={`/events/${eventId}/interactions/bigscreen?tab=network_heat`}
              target="_blank"
              className="inline-flex h-9 items-center rounded-lg bg-brand-blue px-4 text-sm text-white hover:bg-brand-blue/90"
            >
              <Monitor className="mr-1 size-4" />
              打开连接热力大屏
            </Link>
            <Link
              href={`/events/${eventId}/reports#matching`}
              className="inline-flex h-9 items-center rounded-lg border border-border px-4 text-sm hover:bg-content"
            >
              <Handshake className="mr-1 size-4" />
              查看配对报告
            </Link>
          </div>
        </SectionCard>

        <SectionCard
          title="场次管理"
          action={
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={1}
                max={20}
                value={roundCount}
                onChange={(e) =>
                  setRoundCount(Math.max(1, Math.min(20, Number(e.target.value) || 1)))
                }
                className="h-8 w-16 text-center"
                aria-label="轮次数"
              />
              <span className="text-xs text-text-muted">轮</span>
              <Button
                size="sm"
                onClick={() => createMutation.mutate()}
                disabled={createMutation.isPending || hasActive}
              >
                <Plus className="mr-1 size-4" />
                新建场次
              </Button>
            </div>
          }
        >
          {hasActive ? null : (
            <p className="mb-3 text-xs text-text-muted">
              当前无进行中场次，可创建新场次并设置轮次数（默认 3 轮）。
            </p>
          )}

          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : sessions.length === 0 ? (
            <p className="py-8 text-center text-sm text-text-muted">
              暂无 SN 场次，点击「新建场次」开始配置
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>状态</TableHead>
                  <TableHead>轮次</TableHead>
                  <TableHead>配对</TableHead>
                  <TableHead>连接率</TableHead>
                  <TableHead>时间</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessions.map((session) => {
                  const meta = STATUS_META[session.status];
                  const rate =
                    session.pair_count > 0
                      ? Math.round(
                          (session.connection_count / session.pair_count) * 100,
                        )
                      : 0;

                  return (
                    <TableRow key={session.id}>
                      <TableCell>
                        <Badge className={cn("font-normal", meta.className)}>
                          {meta.label}
                        </Badge>
                      </TableCell>
                      <TableCell>{session.round_count} 轮</TableCell>
                      <TableCell>
                        {session.pair_count} 对 / {session.participant_count} 人
                      </TableCell>
                      <TableCell>
                        {session.pair_count > 0 ? `${rate}%` : "—"}
                      </TableCell>
                      <TableCell className="text-xs text-text-muted">
                        {session.started_at
                          ? format(new Date(session.started_at), "MM-dd HH:mm")
                          : format(new Date(session.created_at), "MM-dd HH:mm")}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {session.status === "SCHEDULED" && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  statusMutation.mutate({
                                    sessionId: session.id,
                                    status: "IN_PROGRESS",
                                  })
                                }
                                disabled={statusMutation.isPending}
                              >
                                <Play className="mr-1 size-3.5" />
                                开始
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() =>
                                  statusMutation.mutate({
                                    sessionId: session.id,
                                    status: "CANCELLED",
                                  })
                                }
                                disabled={statusMutation.isPending}
                              >
                                <XCircle className="mr-1 size-3.5" />
                                取消
                              </Button>
                            </>
                          )}
                          {session.status === "IN_PROGRESS" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                statusMutation.mutate({
                                  sessionId: session.id,
                                  status: "COMPLETED",
                                })
                              }
                              disabled={statusMutation.isPending}
                            >
                              <Square className="mr-1 size-3.5" />
                              结束
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </SectionCard>
      </AdminContent>
    </AdminPage>
  );
}
