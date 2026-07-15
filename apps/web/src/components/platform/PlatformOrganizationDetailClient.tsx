"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ArrowLeft, Coins } from "lucide-react";
import { toast } from "sonner";
import { AdminContent } from "@/components/admin/admin-header";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
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
import { cn } from "@/lib/utils";

type OrgDetail = {
  id: string;
  name: string;
  slug: string;
  contactEmail: string | null;
  adminStatus: string;
  industry: string | null;
  website: string | null;
  overdraftLimit: number;
  totals: {
    events: number;
    participants: number;
    leads: number;
    connections: number;
  };
  owner: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
  } | null;
  staff: Array<{
    id: string;
    role: string;
    user: { id: string; name: string; email: string; phone: string | null };
  }>;
  balances: {
    smsBalance: number;
    emailBalance: number;
    interactionPointsBalance: number;
  };
  usage: {
    smsUsed30d: number;
    emailUsed30d: number;
    interactionUsed30d: number;
  };
  events: Array<{
    id: string;
    name: string;
    status: string;
    startDate: string | null;
    endDate: string | null;
    participants: number;
  }>;
  ledgers: Array<{
    id: string;
    type: string;
    resource: string;
    amount: number;
    balanceAfter: number;
    remark: string | null;
    createdAt: string;
  }>;
  orders: Array<{
    id: string;
    title: string;
    status: string;
    amountCents: number;
    paymentChannel: string;
    createdAt: string;
    paidAt: string | null;
    plan: { code: string; name: string; kind: string } | null;
  }>;
};

const STATUS_BADGE: Record<string, string> = {
  APPROVED: "bg-brand-green-light text-brand-green",
  TRIAL: "bg-brand-blue-light text-brand-blue",
  PENDING_REVIEW: "bg-brand-amber-light text-brand-amber",
  SUSPENDED: "bg-brand-red-light text-brand-red",
  REJECTED: "bg-gray-100 text-text-muted",
};

const STATUS_LABEL: Record<string, string> = {
  APPROVED: "已通过",
  TRIAL: "试用",
  PENDING_REVIEW: "待审",
  SUSPENDED: "已挂起",
  REJECTED: "已拒绝",
};

const RESOURCE_LABEL: Record<string, string> = {
  SMS: "短信",
  EMAIL: "邮件",
  INTERACTION_POINT: "互动点",
};

const TYPE_LABEL: Record<string, string> = {
  CREDIT: "入账",
  DEBIT: "消耗",
  ADJUST: "调账",
  REFUND: "退款",
};

async function fetchDetail(orgId: string) {
  const res = await fetch(`/api/platform/organizations/${orgId}`);
  if (!res.ok) throw new Error("加载失败");
  return (await res.json()).data as OrgDetail;
}

export function PlatformOrganizationDetailClient({ orgId }: { orgId: string }) {
  const qc = useQueryClient();
  const [creditOpen, setCreditOpen] = useState(false);
  const [overdraftOpen, setOverdraftOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [creditForm, setCreditForm] = useState({
    resource: "SMS" as "SMS" | "EMAIL" | "INTERACTION_POINT",
    amount: "100",
    remark: "",
  });
  const [overdraft, setOverdraft] = useState("0");

  const { data, isLoading } = useQuery({
    queryKey: ["platform-organization", orgId],
    queryFn: () => fetchDetail(orgId),
  });

  async function refresh(detail: OrgDetail) {
    qc.setQueryData(["platform-organization", orgId], detail);
    void qc.invalidateQueries({ queryKey: ["platform-organizations"] });
  }

  async function handleCredit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch(`/api/platform/organizations/${orgId}/credit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resource: creditForm.resource,
          amount: Number(creditForm.amount),
          remark: creditForm.remark,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "充值失败");
        return;
      }
      toast.success("已代充入账");
      setCreditOpen(false);
      setCreditForm({ resource: "SMS", amount: "100", remark: "" });
      await refresh(json.data as OrgDetail);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleStatus(action: "suspend" | "resume") {
    const label = action === "suspend" ? "挂起" : "恢复";
    if (!window.confirm(`确认${label}该组织账号？`)) return;
    const res = await fetch(`/api/platform/organizations/${orgId}/actions`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const json = await res.json();
    if (!res.ok) {
      toast.error(json.error ?? `${label}失败`);
      return;
    }
    toast.success(`已${label}`);
    await refresh(json.data as OrgDetail);
  }

  async function handleOverdraft(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch(`/api/platform/organizations/${orgId}/actions`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "set_overdraft",
          overdraftLimit: Number(overdraft),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "保存失败");
        return;
      }
      toast.success("透支额度已更新");
      setOverdraftOpen(false);
      await refresh(json.data as OrgDetail);
    } finally {
      setSubmitting(false);
    }
  }

  if (isLoading || !data) {
    return (
      <AdminContent>
        <p className="text-sm text-text-muted">加载中…</p>
      </AdminContent>
    );
  }

  return (
    <AdminContent>
      <div className="mb-6">
        <Link
          href="/platform/organizations"
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "mb-3 -ml-2 h-8")}
        >
          <ArrowLeft className="mr-1 size-4" />
          返回台账
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold">{data.name}</h1>
              <Badge
                className={cn(
                  "border-0 font-normal",
                  STATUS_BADGE[data.adminStatus] ?? "bg-muted",
                )}
              >
                {STATUS_LABEL[data.adminStatus] ?? data.adminStatus}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-text-muted">
              {data.slug}
              {data.contactEmail ? ` · ${data.contactEmail}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              className="bg-brand-blue hover:bg-brand-blue/90"
              onClick={() => setCreditOpen(true)}
            >
              <Coins className="mr-1.5 size-4" />
              代充额度
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setOverdraft(String(data.overdraftLimit));
                setOverdraftOpen(true);
              }}
            >
              透支额度
            </Button>
            {data.adminStatus === "SUSPENDED" ? (
              <Button variant="outline" onClick={() => void handleStatus("resume")}>
                恢复账号
              </Button>
            ) : (
              <Button
                variant="outline"
                className="text-brand-red"
                onClick={() => void handleStatus("suspend")}
              >
                挂起账号
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "活动数", value: data.totals.events },
          { label: "参会人数", value: data.totals.participants },
          { label: "线索", value: data.totals.leads },
          { label: "连接", value: data.totals.connections },
        ].map((item) => (
          <div
            key={item.label}
            className="rounded-xl border border-border-light bg-white px-4 py-3"
          >
            <p className="text-xs text-text-muted">{item.label}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{item.value}</p>
          </div>
        ))}
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        {[
          {
            label: "短信余额",
            value: data.balances.smsBalance,
            used: data.usage.smsUsed30d,
          },
          {
            label: "邮件余额",
            value: data.balances.emailBalance,
            used: data.usage.emailUsed30d,
          },
          {
            label: "互动点余额",
            value: data.balances.interactionPointsBalance,
            used: data.usage.interactionUsed30d,
          },
        ].map((item) => (
          <div
            key={item.label}
            className="rounded-xl border border-border-light bg-white px-4 py-3"
          >
            <p className="text-xs text-text-muted">{item.label}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{item.value}</p>
            <p className="mt-1 text-xs text-text-muted">
              近 30 天消耗 {item.used}
              {item.label.includes("互动")
                ? ` · 透支上限 ${data.overdraftLimit}`
                : ""}
            </p>
          </div>
        ))}
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-border-light bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold">账号信息</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-text-muted">负责人</dt>
              <dd>
                {data.owner
                  ? `${data.owner.name} · ${data.owner.email}`
                  : "—"}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-text-muted">手机</dt>
              <dd>{data.owner?.phone ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-text-muted">行业</dt>
              <dd>{data.industry ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-text-muted">网站</dt>
              <dd className="truncate">{data.website ?? "—"}</dd>
            </div>
          </dl>
          {data.staff.length > 0 && (
            <div className="mt-4 border-t border-border-light pt-3">
              <p className="mb-2 text-xs text-text-muted">组织成员</p>
              <ul className="space-y-1 text-sm">
                {data.staff.map((s) => (
                  <li key={s.id} className="flex justify-between gap-2">
                    <span>
                      {s.user.name}{" "}
                      <span className="text-xs text-text-muted">({s.role})</span>
                    </span>
                    <span className="text-xs text-text-muted">{s.user.email}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <section className="rounded-xl border border-border-light bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold">活动（近 20 场）</h2>
          <div className="max-h-64 space-y-2 overflow-y-auto text-sm">
            {data.events.length === 0 && (
              <p className="text-text-muted">暂无活动</p>
            )}
            {data.events.map((ev) => (
              <div
                key={ev.id}
                className="flex items-center justify-between gap-2 border-b border-border-light/60 py-2 last:border-0"
              >
                <div>
                  <p className="font-medium">{ev.name}</p>
                  <p className="text-xs text-text-muted">
                    {ev.status}
                    {ev.startDate
                      ? ` · ${format(new Date(ev.startDate), "yyyy-MM-dd")}`
                      : ""}
                  </p>
                </div>
                <span className="tabular-nums text-text-muted">
                  {ev.participants} 人
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-border-light bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold">额度流水</h2>
          <div className="max-h-80 overflow-y-auto text-sm">
            {data.ledgers.length === 0 && (
              <p className="text-text-muted">暂无流水</p>
            )}
            {data.ledgers.map((row) => (
              <div
                key={row.id}
                className="border-b border-border-light/60 py-2 last:border-0"
              >
                <div className="flex justify-between gap-2">
                  <span>
                    {TYPE_LABEL[row.type] ?? row.type} ·{" "}
                    {RESOURCE_LABEL[row.resource] ?? row.resource}
                  </span>
                  <span className="tabular-nums font-medium">
                    {row.type === "DEBIT" ? "-" : "+"}
                    {row.amount}
                  </span>
                </div>
                <p className="text-xs text-text-muted">
                  余额 {row.balanceAfter}
                  {row.remark ? ` · ${row.remark}` : ""} ·{" "}
                  {format(new Date(row.createdAt), "MM-dd HH:mm")}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-border-light bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold">订单</h2>
          <div className="max-h-80 overflow-y-auto text-sm">
            {data.orders.length === 0 && (
              <p className="text-text-muted">暂无订单</p>
            )}
            {data.orders.map((order) => (
              <div
                key={order.id}
                className="border-b border-border-light/60 py-2 last:border-0"
              >
                <div className="flex justify-between gap-2">
                  <span className="font-medium">{order.title}</span>
                  <span className="tabular-nums">
                    ¥{(order.amountCents / 100).toFixed(0)}
                  </span>
                </div>
                <p className="text-xs text-text-muted">
                  {order.status} · {order.paymentChannel} ·{" "}
                  {format(new Date(order.createdAt), "yyyy-MM-dd HH:mm")}
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>

      <Dialog open={creditOpen} onOpenChange={setCreditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>代充额度</DialogTitle>
            <DialogDescription>
              写入钱包流水类型为「调账」，请填写业务备注以便对账。
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => void handleCredit(e)} className="space-y-4">
            <div className="space-y-2">
              <Label>资源类型</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={creditForm.resource}
                onChange={(e) =>
                  setCreditForm((f) => ({
                    ...f,
                    resource: e.target.value as typeof f.resource,
                  }))
                }
              >
                <option value="SMS">短信</option>
                <option value="EMAIL">邮件</option>
                <option value="INTERACTION_POINT">互动点</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="credit-amount">数量</Label>
              <Input
                id="credit-amount"
                type="number"
                min={1}
                required
                value={creditForm.amount}
                onChange={(e) =>
                  setCreditForm((f) => ({ ...f, amount: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="credit-remark">备注</Label>
              <Input
                id="credit-remark"
                required
                placeholder="例如：线下到账 / 商务赠送"
                value={creditForm.remark}
                onChange={(e) =>
                  setCreditForm((f) => ({ ...f, remark: e.target.value }))
                }
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreditOpen(false)}>
                取消
              </Button>
              <Button
                type="submit"
                disabled={submitting}
                className="bg-brand-blue hover:bg-brand-blue/90"
              >
                {submitting ? "提交中…" : "确认充值"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={overdraftOpen} onOpenChange={setOverdraftOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>互动点透支额度</DialogTitle>
            <DialogDescription>
              余额耗尽后允许继续使用的点数，0 表示不允许透支。
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => void handleOverdraft(e)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="overdraft">透支上限</Label>
              <Input
                id="overdraft"
                type="number"
                min={0}
                required
                value={overdraft}
                onChange={(e) => setOverdraft(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOverdraftOpen(false)}
              >
                取消
              </Button>
              <Button type="submit" disabled={submitting}>
                保存
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AdminContent>
  );
}
