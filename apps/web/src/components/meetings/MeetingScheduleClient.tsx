"use client";

import { useCallback, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Bot, Calendar, LayoutGrid, Users } from "lucide-react";
import {
  AdminContent,
  AdminHeader,
  AdminPage,
  SectionCard,
} from "@/components/admin/admin-header";
import { DataTable } from "@/components/admin/data-table";
import { ScheduleGrid } from "@/components/meetings/ScheduleGrid";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  ApiMeetingRow,
  ApiMeetingStats,
  ApiScheduleGrid,
} from "@/lib/meetings/schedule-service";

type MeetingsResponse = {
  meetings: ApiMeetingRow[];
  stats: ApiMeetingStats;
};

async function fetchMeetings(
  eventId: string,
  status?: string,
): Promise<MeetingsResponse> {
  const qs = status && status !== "ALL" ? `?status=${status}` : "";
  const res = await fetch(`/api/events/${eventId}/meetings${qs}`);
  if (!res.ok) throw new Error("加载失败");
  return (await res.json()).data;
}

async function fetchGrid(eventId: string): Promise<ApiScheduleGrid> {
  const res = await fetch(`/api/events/${eventId}/meetings/schedule-grid`);
  if (!res.ok) throw new Error("加载网格失败");
  return (await res.json()).data;
}

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: typeof Users;
}) {
  return (
    <div className="rounded-lg border border-border bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-text-muted">{label}</p>
          <p className="mt-1 text-2xl font-semibold text-text">{value}</p>
          {sub && <p className="mt-1 text-xs text-text-muted">{sub}</p>}
        </div>
        <Icon className="h-5 w-5 text-primary/60" />
      </div>
    </div>
  );
}

export function MeetingScheduleClient({
  eventId,
  eventName,
}: {
  eventId: string;
  eventName: string;
}) {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [reassignTarget, setReassignTarget] = useState<ApiMeetingRow | null>(null);
  const [reassignStart, setReassignStart] = useState("");
  const [reassignEnd, setReassignEnd] = useState("");
  const [reassignTableId, setReassignTableId] = useState("");
  const [saving, setSaving] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["event-meetings", eventId, statusFilter],
    queryFn: () => fetchMeetings(eventId, statusFilter),
  });

  const { data: grid, isLoading: gridLoading } = useQuery({
    queryKey: ["meeting-schedule-grid", eventId],
    queryFn: () => fetchGrid(eventId),
  });

  const tableOptions = useMemo(
    () =>
      grid?.rows.map((r) => ({
        id: r.table_id,
        label: `${r.area_name} · ${r.table_name}`,
      })) ?? [],
    [grid],
  );

  const openReassign = useCallback(
    (meeting: ApiMeetingRow) => {
      setReassignTarget(meeting);
      setReassignStart(
        meeting.scheduled_start ? meeting.scheduled_start.slice(0, 16) : "",
      );
      setReassignEnd(meeting.scheduled_end ? meeting.scheduled_end.slice(0, 16) : "");
      setReassignTableId(meeting.table_id ?? tableOptions[0]?.id ?? "");
    },
    [tableOptions],
  );

  const handleCellClick = useCallback(
    (meetingId: string) => {
      const meeting = data?.meetings.find((m) => m.id === meetingId);
      if (meeting) openReassign(meeting);
    },
    [data?.meetings, openReassign],
  );

  const handleReassign = async () => {
    if (!reassignTarget || !reassignTableId) return;
    if (!reassignStart || !reassignEnd) {
      toast.error("请填写开始和结束时间");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(
        `/api/events/${eventId}/meetings/${reassignTarget.id}/reassign`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            scheduled_start: new Date(reassignStart).toISOString(),
            scheduled_end: new Date(reassignEnd).toISOString(),
            table_id: reassignTableId,
          }),
        },
      );
      if (!res.ok) {
        toast.error("调整失败");
        return;
      }
      toast.success("会面时间/桌位已更新");
      setReassignTarget(null);
      void refetch();
      void queryClient.invalidateQueries({ queryKey: ["meeting-schedule-grid", eventId] });
    } finally {
      setSaving(false);
    }
  };

  const stats = data?.stats;
  const meetings = data?.meetings ?? [];

  return (
    <AdminPage>
      <AdminHeader
        title="会面调度"
        description={eventName}
        breadcrumb={["活动", "会面调度"]}
        actions={
          <Button variant="outline" size="sm" onClick={() => void refetch()}>
            刷新
          </Button>
        }
      />
      <AdminContent>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="总会面"
            value={stats?.total ?? "—"}
            sub={
              stats
                ? `待确认 ${stats.by_status.PENDING} · 已确认 ${stats.by_status.ACCEPTED} · 已完成 ${stats.by_status.COMPLETED} · 爽约 ${stats.by_status.NO_SHOW}`
                : undefined
            }
            icon={Users}
          />
          <StatCard
            label="接受率"
            value={stats ? `${stats.acceptance_rate}%` : "—"}
            sub="已接受 / (已接受 + 已婉拒)"
            icon={Calendar}
          />
          <StatCard
            label="AI 促成占比"
            value={stats ? `${stats.ai_facilitated_rate}%` : "—"}
            sub="已排期会面中由 AI 推荐发起"
            icon={Bot}
          />
          <StatCard
            label="桌位利用率"
            value={stats ? `${stats.table_utilization}%` : "—"}
            sub="已占用时段 / 总可用容量"
            icon={LayoutGrid}
          />
        </div>

        <SectionCard
          title="时段网格"
          description="横轴为时段，纵轴为会面桌；绿色已预约，红色为冲突"
        >
          <ScheduleGrid
            grid={grid ?? null}
            loading={gridLoading}
            onCellClick={handleCellClick}
          />
        </SectionCard>

        <SectionCard
          title="会面列表"
          description="筛选、查看详情，可手动调整桌位与时间"
          action={
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v ?? "ALL")}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">全部状态</SelectItem>
                <SelectItem value="PENDING">待确认</SelectItem>
                <SelectItem value="ACCEPTED">已确认</SelectItem>
                <SelectItem value="COMPLETED">已完成</SelectItem>
                <SelectItem value="NO_SHOW">爽约</SelectItem>
                <SelectItem value="DECLINED">已婉拒</SelectItem>
                <SelectItem value="CANCELLED">已取消</SelectItem>
              </SelectContent>
            </Select>
          }
        >
          {isLoading ? (
            <p className="py-6 text-center text-sm text-text-muted">加载中…</p>
          ) : (
            <DataTable
              data={meetings}
              getRowKey={(row) => row.id}
              columns={[
                {
                  key: "requester",
                  header: "发起人",
                  cell: (row) => row.requester.name,
                },
                {
                  key: "recipient",
                  header: "接收人",
                  cell: (row) => row.recipient.name,
                },
                {
                  key: "status",
                  header: "状态",
                  cell: (row) => (
                    <span
                      className={
                        row.conflict
                          ? "font-medium text-red-600"
                          : row.status === "ACCEPTED"
                            ? "text-emerald-700"
                            : ""
                      }
                    >
                      {row.status_label}
                      {row.conflict ? " · 冲突" : ""}
                    </span>
                  ),
                },
                {
                  key: "time",
                  header: "时间",
                  cell: (row) =>
                    row.scheduled_start
                      ? new Date(row.scheduled_start).toLocaleString("zh-CN", {
                          month: "numeric",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "—",
                },
                {
                  key: "table",
                  header: "桌号",
                  cell: (row) =>
                    row.table_name
                      ? `${row.area_name ?? ""} ${row.table_name}`.trim()
                      : "—",
                },
                {
                  key: "ai",
                  header: "AI",
                  cell: (row) =>
                    row.from_ai_match ? (
                      <span className="text-primary">
                        AI{row.ai_match_score ? ` ${Math.round(row.ai_match_score)}` : ""}
                      </span>
                    ) : (
                      "—"
                    ),
                },
                {
                  key: "actions",
                  header: "",
                  cell: (row) => (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openReassign(row)}
                    >
                      调整
                    </Button>
                  ),
                },
              ]}
            />
          )}
        </SectionCard>
      </AdminContent>

      <Dialog open={!!reassignTarget} onOpenChange={(o) => !o && setReassignTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>手动调整会面</DialogTitle>
          </DialogHeader>
          {reassignTarget && (
            <div className="space-y-4 py-2">
              <p className="text-sm text-text-muted">
                {reassignTarget.requester.name} ↔ {reassignTarget.recipient.name}
              </p>
              <div className="space-y-2">
                <Label>开始时间</Label>
                <Input
                  type="datetime-local"
                  value={reassignStart}
                  onChange={(e) => setReassignStart(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>结束时间</Label>
                <Input
                  type="datetime-local"
                  value={reassignEnd}
                  onChange={(e) => setReassignEnd(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>会面桌</Label>
                <Select value={reassignTableId} onValueChange={(v) => setReassignTableId(v ?? "")}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择桌位" />
                  </SelectTrigger>
                  <SelectContent>
                    {tableOptions.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setReassignTarget(null)}>
              取消
            </Button>
            <Button onClick={() => void handleReassign()} disabled={saving}>
              {saving ? "保存中…" : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminPage>
  );
}
