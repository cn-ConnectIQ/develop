"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Map, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  AdminContent,
  AdminHeader,
  AdminPage,
  SectionCard,
} from "@/components/admin/admin-header";
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

type BoothRow = {
  id: string;
  code: string;
  name: string;
  status: "AVAILABLE" | "BOOKED" | "OCCUPIED";
  exhibitor: { id: string; name: string };
  _count: { leads: number };
  stats: { todayVisitors: number; gradeA: number; crmSynced: number };
};

type BoothMapData = {
  booths: BoothRow[];
  exhibitors: Array<{ id: string; name: string }>;
};

const STATUS_OPTIONS = [
  { value: "AVAILABLE", label: "空闲" },
  { value: "BOOKED", label: "已预订" },
  { value: "OCCUPIED", label: "已入驻" },
] as const;

async function fetchBooths(eventId: string): Promise<BoothMapData> {
  const res = await fetch(`/api/events/${eventId}/booths`);
  if (!res.ok) throw new Error("加载失败");
  return (await res.json()).data as BoothMapData;
}

type BoothForm = {
  code: string;
  name: string;
  exhibitorId: string;
  status: BoothRow["status"];
};

const emptyForm: BoothForm = {
  code: "",
  name: "",
  exhibitorId: "",
  status: "AVAILABLE",
};

export function ExpoBoothsPageClient({
  eventId,
  eventName,
}: {
  eventId: string;
  eventName: string;
}) {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<BoothRow | null>(null);
  const [form, setForm] = useState<BoothForm>(emptyForm);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data, isLoading } = useQuery({
    queryKey: ["expo-booths", eventId],
    queryFn: () => fetchBooths(eventId),
  });

  const booths = data?.booths ?? [];
  const exhibitors = data?.exhibitors ?? [];

  const filtered = useMemo(() => {
    if (statusFilter === "all") return booths;
    return booths.filter((b) => b.status === statusFilter);
  }, [booths, statusFilter]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editing) {
        const res = await fetch(
          `/api/events/${eventId}/booths/${editing.id}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              code: form.code,
              name: form.name,
              exhibitorId: form.exhibitorId || undefined,
              status: form.status,
            }),
          },
        );
        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          throw new Error(json.message ?? "保存失败");
        }
        return;
      }

      const res = await fetch(`/api/events/${eventId}/booths`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: form.code,
          name: form.name,
          exhibitorId: form.exhibitorId || undefined,
          status: form.status,
        }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.message ?? "创建失败");
      }
    },
    onSuccess: () => {
      toast.success(editing ? "已更新展位" : "已创建展位");
      setDialogOpen(false);
      setEditing(null);
      setForm(emptyForm);
      void queryClient.invalidateQueries({ queryKey: ["expo-booths", eventId] });
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "操作失败"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (boothId: string) => {
      const res = await fetch(`/api/events/${eventId}/booths/${boothId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("删除失败");
    },
    onSuccess: () => {
      toast.success("已删除展位");
      void queryClient.invalidateQueries({ queryKey: ["expo-booths", eventId] });
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "删除失败"),
  });

  function openCreate() {
    setEditing(null);
    setForm({
      ...emptyForm,
      exhibitorId: exhibitors[0]?.id ?? "",
    });
    setDialogOpen(true);
  }

  function openEdit(booth: BoothRow) {
    setEditing(booth);
    setForm({
      code: booth.code,
      name: booth.name,
      exhibitorId: booth.exhibitor.id,
      status: booth.status,
    });
    setDialogOpen(true);
  }

  async function quickStatusChange(booth: BoothRow, status: BoothRow["status"]) {
    const res = await fetch(`/api/events/${eventId}/booths/${booth.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      toast.error("状态更新失败");
      return;
    }
    toast.success("状态已更新");
    void queryClient.invalidateQueries({ queryKey: ["expo-booths", eventId] });
  }

  return (
    <AdminPage>
      <AdminHeader
        title="展位管理"
        description={eventName}
        breadcrumb={["展会", "展位"]}
        actions={
          <div className="flex gap-2">
            <Link
              href={`/events/${eventId}/exhibitors/map`}
              className="inline-flex h-9 items-center rounded-lg border border-border-light px-4 text-sm hover:bg-content"
            >
              <Map className="mr-1 size-4" />
              展位地图
            </Link>
            <Button
              className="bg-brand-blue text-white"
              onClick={openCreate}
              disabled={exhibitors.length === 0}
            >
              <Plus className="mr-1 size-4" />
              新建展位
            </Button>
          </div>
        }
      />

      <AdminContent>
        <SectionCard
          title={`全部展位（${booths.length}）`}
          description="管理展位编号、展商分配与入驻状态"
        >
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <Select
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v ?? "all")}
            >
              <SelectTrigger className="h-9 w-36">
                <SelectValue placeholder="筛选状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部状态</SelectItem>
                {STATUS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Link
              href={`/events/${eventId}/exhibitors/form-config`}
              className="text-sm text-brand-blue hover:underline"
            >
              采集表单配置 →
            </Link>
          </div>

          {isLoading ? (
            <p className="py-12 text-center text-sm text-text-muted">加载中…</p>
          ) : filtered.length === 0 ? (
            <p className="py-12 text-center text-sm text-text-muted">
              {booths.length === 0
                ? "暂无展位，点击「新建展位」开始配置"
                : "当前筛选条件下无展位"}
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border-light">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-[#fafaf8] text-left text-xs text-text-muted">
                    <th className="p-3">展位号</th>
                    <th className="p-3">名称</th>
                    <th className="p-3">展商</th>
                    <th className="p-3">状态</th>
                    <th className="p-3">线索</th>
                    <th className="p-3">今日访客</th>
                    <th className="p-3 text-right">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((booth) => (
                    <tr key={booth.id} className="border-b hover:bg-gray-50/80">
                      <td className="p-3 font-mono font-medium text-brand-blue">
                        {booth.code}
                      </td>
                      <td className="p-3">{booth.name}</td>
                      <td className="p-3">{booth.exhibitor.name}</td>
                      <td className="p-3">
                        <Select
                          value={booth.status}
                          onValueChange={(v) =>
                            void quickStatusChange(
                              booth,
                              v as BoothRow["status"],
                            )
                          }
                        >
                          <SelectTrigger className="h-8 w-28 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {STATUS_OPTIONS.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="p-3 tabular-nums">{booth._count.leads}</td>
                      <td className="p-3 tabular-nums">
                        {booth.stats.todayVisitors}
                      </td>
                      <td className="p-3">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            onClick={() => openEdit(booth)}
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 text-brand-red hover:text-brand-red"
                            onClick={() => {
                              if (
                                confirm(
                                  `确定删除展位 ${booth.code}？关联线索将一并删除。`,
                                )
                              ) {
                                deleteMutation.mutate(booth.id);
                              }
                            }}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      </AdminContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "编辑展位" : "新建展位"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div>
              <Label>展位号</Label>
              <Input
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                placeholder="如 A101"
              />
            </div>
            <div>
              <Label>展位名称</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="如 智能硬件展区"
              />
            </div>
            <div>
              <Label>分配展商</Label>
              <Select
                value={form.exhibitorId}
                onValueChange={(v) =>
                  setForm({ ...form, exhibitorId: v ?? "" })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择展商" />
                </SelectTrigger>
                <SelectContent>
                  {exhibitors.map((ex) => (
                    <SelectItem key={ex.id} value={ex.id}>
                      {ex.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>状态</Label>
              <Select
                value={form.status}
                onValueChange={(v) =>
                  setForm({ ...form, status: v as BoothRow["status"] })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              取消
            </Button>
            <Button
              className="bg-brand-blue text-white"
              disabled={
                !form.code.trim() ||
                !form.name.trim() ||
                !form.exhibitorId ||
                saveMutation.isPending
              }
              onClick={() => saveMutation.mutate()}
            >
              {saveMutation.isPending ? "保存中…" : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminPage>
  );
}
