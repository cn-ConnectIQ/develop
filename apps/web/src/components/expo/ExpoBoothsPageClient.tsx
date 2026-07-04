"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Map, ClipboardList, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  AdminContent,
  AdminHeader,
  AdminPage,
  SectionCard,
} from "@/components/admin/admin-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ExhibitorReviewsPanel } from "@/components/expo/ExhibitorReviewsPanel";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableShell,
  TableToolbar,
} from "@/components/ui/table";
import { StatusChip, type StatusChipVariant } from "@/components/ui/status-chip";

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

function boothStatusVariant(status: BoothRow["status"]): StatusChipVariant {
  switch (status) {
    case "AVAILABLE":
      return "neutral";
    case "BOOKED":
      return "warning";
    case "OCCUPIED":
      return "success";
  }
}

function boothStatusLabel(status: BoothRow["status"]) {
  return STATUS_OPTIONS.find((opt) => opt.value === status)?.label ?? status;
}

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
        title="展商列表"
        description={eventName}
        breadcrumb={["展商管理", "展商列表"]}
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
        <ExhibitorReviewsPanel
          eventId={eventId}
          onChanged={() =>
            void queryClient.invalidateQueries({
              queryKey: ["expo-booths", eventId],
            })
          }
        />

        <SectionCard
          title={`全部展位（${booths.length}）`}
          description="管理展位编号、展商分配与入驻状态"
        >
          <div className="space-y-4">
          <TableToolbar>
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
          </TableToolbar>

          {isLoading ? (
            <p className="py-12 text-center text-sm text-text-secondary">加载中…</p>
          ) : filtered.length === 0 ? (
            <p className="py-12 text-center text-sm text-text-secondary">
              {booths.length === 0
                ? "暂无展位，点击「新建展位」开始配置"
                : "当前筛选条件下无展位"}
            </p>
          ) : (
            <TableShell>
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-surface-secondary">
                    <TableHead>展位号</TableHead>
                    <TableHead>名称</TableHead>
                    <TableHead>展商</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>线索</TableHead>
                    <TableHead>今日访客</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((booth) => (
                    <TableRow key={booth.id} className="h-12">
                      <TableCell className="font-mono font-medium text-brand-blue">
                        {booth.code}
                      </TableCell>
                      <TableCell>{booth.name}</TableCell>
                      <TableCell>{booth.exhibitor.name}</TableCell>
                      <TableCell>
                        <Select
                          value={booth.status}
                          onValueChange={(v) =>
                            void quickStatusChange(
                              booth,
                              v as BoothRow["status"],
                            )
                          }
                        >
                          <SelectTrigger className="h-auto w-auto border-0 bg-transparent p-0 shadow-none focus-visible:ring-0">
                            <StatusChip variant={boothStatusVariant(booth.status)}>
                              {boothStatusLabel(booth.status)}
                            </StatusChip>
                          </SelectTrigger>
                          <SelectContent>
                            {STATUS_OPTIONS.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="tabular-nums">{booth._count.leads}</TableCell>
                      <TableCell className="tabular-nums">
                        {booth.stats.todayVisitors}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Link
                            href={`/events/${eventId}/exhibitors/form-config?boothId=${booth.id}`}
                            title="采集表单配置"
                            className={cn(
                              buttonVariants({ variant: "ghost", size: "icon" }),
                              "size-8",
                            )}
                          >
                            <ClipboardList className="size-3.5" />
                          </Link>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            title="编辑展位"
                            onClick={() => openEdit(booth)}
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 text-brand-red hover:text-brand-red"
                            title="删除展位"
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
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableShell>
          )}
          </div>
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
