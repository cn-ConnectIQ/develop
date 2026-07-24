"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Store, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AdminPageBody } from "@/components/layout/AdminLayout";
import { PageHead } from "@/components/admin/page-head";
import { Button, buttonVariants } from "@/components/ui/button";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableShell,
} from "@/components/ui/table";
import { withPublicPath } from "@/lib/public-path";
import { cn } from "@/lib/utils";
import type { HostExhibitorDirectoryItem } from "@/lib/host-exhibitor-directory-service";

type FormState = {
  companyName: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  notes: string;
};

const emptyForm: FormState = {
  companyName: "",
  contactName: "",
  contactPhone: "",
  contactEmail: "",
  notes: "",
};

async function fetchDirectory(): Promise<HostExhibitorDirectoryItem[]> {
  const res = await fetch(withPublicPath("/api/me/exhibitor-directory"), {
    cache: "no-store",
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? "加载失败");
  return (json.data?.items ?? []) as HostExhibitorDirectoryItem[];
}

export function OrganizerExhibitorsClient() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<HostExhibitorDirectoryItem | null>(
    null,
  );
  const [form, setForm] = useState<FormState>(emptyForm);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["exhibitor-directory"],
    queryFn: fetchDirectory,
  });

  const items = data ?? [];

  const title = useMemo(
    () => (editing ? "编辑参展企业" : "新建参展企业"),
    [editing],
  );

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.companyName.trim()) throw new Error("请填写企业名称");
      const payload = {
        companyName: form.companyName.trim(),
        contactName: form.contactName.trim() || null,
        contactPhone: form.contactPhone.trim() || null,
        contactEmail: form.contactEmail.trim() || null,
        notes: form.notes.trim() || null,
      };
      const url = editing
        ? withPublicPath(`/api/me/exhibitor-directory/${editing.id}`)
        : withPublicPath("/api/me/exhibitor-directory");
      const res = await fetch(url, {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "保存失败");
    },
    onSuccess: () => {
      toast.success(editing ? "已更新" : "已添加");
      setDialogOpen(false);
      setEditing(null);
      setForm(emptyForm);
      void queryClient.invalidateQueries({ queryKey: ["exhibitor-directory"] });
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "保存失败"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(
        withPublicPath(`/api/me/exhibitor-directory/${id}`),
        { method: "DELETE" },
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "删除失败");
    },
    onSuccess: () => {
      toast.success("已删除");
      void queryClient.invalidateQueries({ queryKey: ["exhibitor-directory"] });
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "删除失败"),
  });

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEdit(item: HostExhibitorDirectoryItem) {
    setEditing(item);
    setForm({
      companyName: item.companyName,
      contactName: item.contactName ?? "",
      contactPhone: item.contactPhone ?? "",
      contactEmail: item.contactEmail ?? "",
      notes: item.notes ?? "",
    });
    setDialogOpen(true);
  }

  return (
    <AdminPageBody>
      <PageHead
        title="参展企业库"
        description="维护可跨活动复用的参展企业；创建展位时可直接从企业库分配"
        actions={
          <Button
            className="bg-brand-blue text-white hover:bg-brand-blue/90"
            onClick={openCreate}
          >
            <Plus className="mr-1.5 size-4" />
            添加企业
          </Button>
        }
      />

      <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-border-light bg-content px-4 py-3 text-sm text-text-muted">
        <p className="inline-flex items-center gap-2">
          <Store className="size-4 text-brand-blue" />
          历史活动中已分配过的展商会自动同步到此列表
        </p>
        <Link
          href={withPublicPath("/organizer/dashboard")}
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          返回账号中心
        </Link>
      </div>

      {isLoading && (
        <p className="py-12 text-center text-sm text-text-muted">加载中…</p>
      )}
      {isError && (
        <div className="py-12 text-center">
          <p className="text-sm text-brand-red">
            {error instanceof Error ? error.message : "加载失败"}
          </p>
          <button
            type="button"
            className="mt-3 text-xs text-brand-blue hover:underline"
            onClick={() => void refetch()}
          >
            点击重试
          </button>
        </div>
      )}

      {!isLoading && !isError && items.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border-light py-16 text-center">
          <p className="text-sm text-text-muted">暂无参展企业</p>
          <Button className="mt-4 bg-brand-blue text-white" onClick={openCreate}>
            添加第一家企业
          </Button>
        </div>
      )}

      {!isLoading && items.length > 0 && (
        <TableShell>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>企业名称</TableHead>
                <TableHead>对接人</TableHead>
                <TableHead>手机</TableHead>
                <TableHead>邮箱</TableHead>
                <TableHead>备注</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.companyName}</TableCell>
                  <TableCell>{item.contactName || "—"}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {item.contactPhone || "—"}
                  </TableCell>
                  <TableCell className="text-xs">
                    {item.contactEmail || "—"}
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate text-text-muted">
                    {item.notes || "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        title="编辑"
                        onClick={() => openEdit(item)}
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-brand-red hover:text-brand-red"
                        title="删除"
                        onClick={() => {
                          if (confirm(`确定从企业库移除「${item.companyName}」？`)) {
                            deleteMutation.mutate(item.id);
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div>
              <Label>企业名称</Label>
              <Input
                value={form.companyName}
                onChange={(e) =>
                  setForm({ ...form, companyName: e.target.value })
                }
                placeholder="如 某某科技有限公司"
              />
            </div>
            <div>
              <Label>对接人</Label>
              <Input
                value={form.contactName}
                onChange={(e) =>
                  setForm({ ...form, contactName: e.target.value })
                }
                placeholder="选填"
              />
            </div>
            <div>
              <Label>手机</Label>
              <Input
                value={form.contactPhone}
                onChange={(e) =>
                  setForm({ ...form, contactPhone: e.target.value })
                }
                placeholder="选填"
              />
            </div>
            <div>
              <Label>邮箱</Label>
              <Input
                value={form.contactEmail}
                onChange={(e) =>
                  setForm({ ...form, contactEmail: e.target.value })
                }
                placeholder="选填"
              />
            </div>
            <div>
              <Label>备注</Label>
              <Input
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="选填"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              取消
            </Button>
            <Button
              className="bg-brand-blue text-white"
              disabled={!form.companyName.trim() || saveMutation.isPending}
              onClick={() => saveMutation.mutate()}
            >
              {saveMutation.isPending ? "保存中…" : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminPageBody>
  );
}
