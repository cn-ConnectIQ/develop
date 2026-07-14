"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { toast } from "sonner";
import { AdminPageBody } from "@/components/layout/AdminLayout";
import { PageHead } from "@/components/admin/page-head";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Plan = {
  id: string;
  code: string;
  kind: string;
  name: string;
  description: string | null;
  priceCents: number;
  includesSms: number;
  includesEmail: number;
  includesInteractionPoints: number;
};

type Order = {
  id: string;
  title: string;
  status: string;
  amountCents: number;
  paymentChannel: string;
  createdAt: string;
  paidAt: string | null;
  plan?: Plan | null;
};

type WalletData = {
  balances: {
    smsBalance: number;
    emailBalance: number;
    interactionPointsBalance: number;
  };
  ledgers: Array<{
    id: string;
    type: string;
    resource: string;
    amount: number;
    balanceAfter: number;
    remark: string | null;
    createdAt: string;
  }>;
};

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.error ?? body.message ?? "请求失败");
  }
  return body.data as T;
}

function formatYuan(cents: number) {
  return `¥${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

const KIND_LABEL: Record<string, string> = {
  EVENT_USAGE: "办会套餐",
  SMS_PACK: "短信包",
  EMAIL_PACK: "邮件包",
  INTERACTION_TOPUP: "互动点",
};

const STATUS_LABEL: Record<string, string> = {
  PENDING: "待支付",
  PAID: "已支付",
  FAILED: "失败",
  CANCELLED: "已取消",
  REFUNDED: "已退款",
};

export function OrganizerBillingClient() {
  const qc = useQueryClient();

  const walletQuery = useQuery({
    queryKey: ["billing-wallet"],
    queryFn: () => fetchJson<WalletData>("/api/billing/wallet"),
  });

  const plansQuery = useQuery({
    queryKey: ["billing-plans"],
    queryFn: () => fetchJson<Plan[]>("/api/billing/plans"),
  });

  const ordersQuery = useQuery({
    queryKey: ["billing-orders"],
    queryFn: () => fetchJson<Order[]>("/api/billing/orders"),
  });

  const channelsQuery = useQuery({
    queryKey: ["billing-channels"],
    queryFn: () =>
      fetchJson<{
        alipay: { configured: boolean; missing: string[] };
        wechat: { configured: boolean };
      }>("/api/billing/channels"),
  });

  const payMutation = useMutation({
    mutationFn: async (planId: string) => {
      const order = await fetchJson<Order>("/api/billing/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, paymentChannel: "ALIPAY" }),
      });
      const pay = await fetchJson<{ payUrl: string }>(
        `/api/billing/orders/${order.id}/pay`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ channel: "ALIPAY" }),
        },
      );
      return pay;
    },
    onSuccess: (data) => {
      toast.success("正在跳转支付宝…");
      window.location.href = data.payUrl;
    },
    onError: (err: Error) => {
      toast.error(err.message || "发起支付失败");
    },
  });

  const balances = walletQuery.data?.balances;
  const alipayReady = channelsQuery.data?.alipay.configured ?? false;

  return (
    <AdminPageBody>
      <PageHead
        title="计费与充值"
        description="购买办会套餐与短信/邮件包；正式账号发布活动与发邀请将扣减对应额度"
      />

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        {[
          { label: "短信余额", value: balances?.smsBalance ?? "—" },
          { label: "邮件余额", value: balances?.emailBalance ?? "—" },
          {
            label: "互动点",
            value: balances?.interactionPointsBalance ?? "—",
          },
        ].map((card) => (
          <div
            key={card.label}
            className="rounded-2xl border border-border-light bg-white px-5 py-4"
          >
            <p className="text-sm text-text-muted">{card.label}</p>
            <p className="mt-1 text-2xl font-semibold text-[var(--admin-ink)]">
              {card.value}
            </p>
          </div>
        ))}
      </div>

      {!alipayReady && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          支付宝尚未在当前环境配置完整
          {channelsQuery.data?.alipay.missing?.length
            ? `（缺少 ${channelsQuery.data.alipay.missing.join("、")}）`
            : ""}
          。本地请检查 `.env.local`，生产请配置 CloudBase 环境变量。
        </div>
      )}

      <section className="mb-10">
        <h2 className="mb-3 text-base font-semibold text-[var(--admin-ink)]">
          可购套餐
        </h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {(plansQuery.data ?? []).map((plan) => (
            <div
              key={plan.id}
              className="flex flex-col rounded-2xl border border-border-light bg-white p-5"
            >
              <p className="text-xs font-medium uppercase tracking-wide text-text-tertiary">
                {KIND_LABEL[plan.kind] ?? plan.kind}
              </p>
              <h3 className="mt-1 text-lg font-semibold text-[var(--admin-ink)]">
                {plan.name}
              </h3>
              <p className="mt-1 flex-1 text-sm text-text-muted">
                {plan.description || "—"}
              </p>
              <ul className="mt-3 space-y-1 text-xs text-text-muted">
                {plan.includesInteractionPoints > 0 && (
                  <li>互动点 +{plan.includesInteractionPoints}</li>
                )}
                {plan.includesSms > 0 && <li>短信 +{plan.includesSms}</li>}
                {plan.includesEmail > 0 && <li>邮件 +{plan.includesEmail}</li>}
              </ul>
              <div className="mt-4 flex items-center justify-between gap-3">
                <span className="text-xl font-semibold text-brand-blue">
                  {formatYuan(plan.priceCents)}
                </span>
                <Button
                  size="sm"
                  disabled={!alipayReady || payMutation.isPending}
                  onClick={() => payMutation.mutate(plan.id)}
                >
                  支付宝购买
                </Button>
              </div>
            </div>
          ))}
          {plansQuery.isLoading && (
            <p className="text-sm text-text-muted">加载套餐中…</p>
          )}
          {!plansQuery.isLoading && (plansQuery.data?.length ?? 0) === 0 && (
            <p className="text-sm text-text-muted">
              暂无套餐。请先执行{" "}
              <code className="rounded bg-muted px-1">
                pnpm --filter @connectiq/database db:seed:billing-plans
              </code>
            </p>
          )}
        </div>
      </section>

      <section className="mb-10">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-[var(--admin-ink)]">
            最近订单
          </h2>
          <button
            type="button"
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
            onClick={() => {
              void qc.invalidateQueries({ queryKey: ["billing-orders"] });
              void qc.invalidateQueries({ queryKey: ["billing-wallet"] });
            }}
          >
            刷新
          </button>
        </div>
        <div className="overflow-hidden rounded-2xl border border-border-light bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/40 text-text-muted">
              <tr>
                <th className="px-4 py-2 font-medium">套餐</th>
                <th className="px-4 py-2 font-medium">金额</th>
                <th className="px-4 py-2 font-medium">状态</th>
                <th className="px-4 py-2 font-medium">时间</th>
                <th className="px-4 py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {(ordersQuery.data ?? []).map((order) => (
                <tr key={order.id} className="border-t border-border-light">
                  <td className="px-4 py-2.5">{order.title}</td>
                  <td className="px-4 py-2.5">{formatYuan(order.amountCents)}</td>
                  <td className="px-4 py-2.5">
                    {STATUS_LABEL[order.status] ?? order.status}
                  </td>
                  <td className="px-4 py-2.5 text-text-muted">
                    {format(new Date(order.createdAt), "yyyy-MM-dd HH:mm")}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {order.status === "PENDING" && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!alipayReady || payMutation.isPending}
                        onClick={async () => {
                          try {
                            const pay = await fetchJson<{ payUrl: string }>(
                              `/api/billing/orders/${order.id}/pay`,
                              {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ channel: "ALIPAY" }),
                              },
                            );
                            window.location.href = pay.payUrl;
                          } catch (err) {
                            toast.error(
                              err instanceof Error ? err.message : "支付失败",
                            );
                          }
                        }}
                      >
                        继续支付
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
              {!ordersQuery.isLoading &&
                (ordersQuery.data?.length ?? 0) === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-8 text-center text-text-muted"
                    >
                      暂无订单
                    </td>
                  </tr>
                )}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-base font-semibold text-[var(--admin-ink)]">
          额度流水
        </h2>
        <div className="overflow-hidden rounded-2xl border border-border-light bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/40 text-text-muted">
              <tr>
                <th className="px-4 py-2 font-medium">资源</th>
                <th className="px-4 py-2 font-medium">方向</th>
                <th className="px-4 py-2 font-medium">数量</th>
                <th className="px-4 py-2 font-medium">余额</th>
                <th className="px-4 py-2 font-medium">说明</th>
                <th className="px-4 py-2 font-medium">时间</th>
              </tr>
            </thead>
            <tbody>
              {(walletQuery.data?.ledgers ?? []).map((row) => (
                <tr key={row.id} className="border-t border-border-light">
                  <td className="px-4 py-2.5">{row.resource}</td>
                  <td className="px-4 py-2.5">{row.type}</td>
                  <td className="px-4 py-2.5">{row.amount}</td>
                  <td className="px-4 py-2.5">{row.balanceAfter}</td>
                  <td className="px-4 py-2.5 text-text-muted">
                    {row.remark ?? "—"}
                  </td>
                  <td className="px-4 py-2.5 text-text-muted">
                    {format(new Date(row.createdAt), "MM-dd HH:mm")}
                  </td>
                </tr>
              ))}
              {!walletQuery.isLoading &&
                (walletQuery.data?.ledgers.length ?? 0) === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-8 text-center text-text-muted"
                    >
                      暂无流水
                    </td>
                  </tr>
                )}
            </tbody>
          </table>
        </div>
      </section>
    </AdminPageBody>
  );
}
