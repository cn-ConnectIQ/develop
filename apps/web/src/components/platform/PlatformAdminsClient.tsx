"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import { Copy, Plus, Shield } from "lucide-react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { AdminContent } from "@/components/admin/admin-header";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type AdminRow = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  createdAt: string;
};

type CreateResult = {
  mode: "created" | "promoted";
  userId: string;
  email: string;
  name: string;
  phone: string | null;
  initialPassword: string;
};

async function fetchAdmins() {
  const res = await fetch("/api/platform/admins");
  if (!res.ok) throw new Error("加载失败");
  return (await res.json()).data as { admins: AdminRow[]; total: number };
}

export function PlatformAdminsClient() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [credOpen, setCredOpen] = useState(false);
  const [created, setCreated] = useState<CreateResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
  });

  const { data, isLoading } = useQuery({
    queryKey: ["platform-admins"],
    queryFn: fetchAdmins,
  });

  const admins = data?.admins ?? [];
  const meId = session?.user?.id;

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/platform/admins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          phone: form.phone || null,
          password: form.password || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "添加失败");
        return;
      }
      const result = json.data as CreateResult;
      setCreated(result);
      setOpen(false);
      setCredOpen(true);
      setForm({ name: "", email: "", phone: "", password: "" });
      toast.success(
        result.mode === "promoted"
          ? "已将该用户提升为平台管理员"
          : "已创建平台管理员",
      );
      void queryClient.invalidateQueries({ queryKey: ["platform-admins"] });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRevoke(admin: AdminRow) {
    if (admin.id === meId) {
      toast.error("不能撤销自己的权限");
      return;
    }
    if (
      !window.confirm(
        `确认撤销「${admin.name}」的平台管理员权限？撤销后对方将无法进入平台后台。`,
      )
    ) {
      return;
    }
    const res = await fetch(`/api/platform/admins/${admin.id}`, {
      method: "DELETE",
    });
    const json = await res.json();
    if (!res.ok) {
      toast.error(json.error ?? "撤销失败");
      return;
    }
    toast.success("已撤销平台管理员权限");
    void queryClient.invalidateQueries({ queryKey: ["platform-admins"] });
  }

  function copyText(text: string) {
    void navigator.clipboard.writeText(text);
    toast.success("已复制");
  }

  return (
    <AdminContent>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">平台管理员</h1>
          <p className="mt-1 text-sm text-text-muted">
            仅平台管理员可管理此项。添加后对方可用邮箱验证码或账号密码登录管理后台。
          </p>
        </div>
        <Button
          className="bg-brand-blue hover:bg-brand-blue/90"
          onClick={() => setOpen(true)}
        >
          <Plus className="mr-1.5 size-4" />
          添加管理员
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl border border-border-light bg-white">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">姓名</th>
              <th className="px-4 py-3 font-medium">邮箱</th>
              <th className="px-4 py-3 font-medium">手机</th>
              <th className="px-4 py-3 font-medium">加入时间</th>
              <th className="px-4 py-3 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-text-muted">
                  加载中…
                </td>
              </tr>
            )}
            {!isLoading && admins.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-text-muted">
                  暂无平台管理员
                </td>
              </tr>
            )}
            {admins.map((admin) => (
              <tr key={admin.id} className="border-t border-border-light">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Shield className="size-4 text-brand-green" />
                    <span className="font-medium">{admin.name}</span>
                    {admin.id === meId && (
                      <span className="rounded bg-brand-blue/10 px-1.5 py-0.5 text-xs text-brand-blue">
                        我
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-text-secondary">{admin.email}</td>
                <td className="px-4 py-3 text-text-secondary">
                  {admin.phone ?? "—"}
                </td>
                <td className="px-4 py-3 text-text-muted">
                  {format(new Date(admin.createdAt), "yyyy-MM-dd", {
                    locale: zhCN,
                  })}
                </td>
                <td className="px-4 py-3">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 text-brand-red"
                    disabled={admin.id === meId || admins.length <= 1}
                    onClick={() => void handleRevoke(admin)}
                  >
                    撤销
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>添加平台管理员</DialogTitle>
            <DialogDescription>
              若邮箱已存在，将直接提升为平台管理员并重置登录密码；否则创建新账号。
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => void handleCreate(e)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="pa-name">姓名</Label>
              <Input
                id="pa-name"
                required
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pa-email">邮箱</Label>
              <Input
                id="pa-email"
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pa-phone">手机（可选）</Label>
              <Input
                id="pa-phone"
                inputMode="numeric"
                placeholder="用于手机验证码登录"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pa-password">初始密码（可选）</Label>
              <Input
                id="pa-password"
                type="text"
                placeholder="留空则自动生成 12 位密码"
                value={form.password}
                onChange={(e) =>
                  setForm((f) => ({ ...f, password: e.target.value }))
                }
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                取消
              </Button>
              <Button
                type="submit"
                className="bg-brand-blue hover:bg-brand-blue/90"
                disabled={submitting}
              >
                {submitting ? "提交中…" : "确认添加"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={credOpen} onOpenChange={setCredOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>请妥善告知对方登录信息</DialogTitle>
            <DialogDescription>
              初始密码仅展示一次，关闭后无法再次查看。对方首次登录后建议立即修改密码。
            </DialogDescription>
          </DialogHeader>
          {created && (
            <div className="space-y-3 rounded-lg border border-border-light bg-muted/30 p-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="text-text-muted">邮箱</span>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 font-medium"
                  onClick={() => copyText(created.email)}
                >
                  {created.email}
                  <Copy className="size-3.5" />
                </button>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-text-muted">初始密码</span>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 font-mono font-medium"
                  onClick={() => copyText(created.initialPassword)}
                >
                  {created.initialPassword}
                  <Copy className="size-3.5" />
                </button>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setCredOpen(false)}>我已记下</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminContent>
  );
}
