"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function BillingResultInner() {
  const params = useSearchParams();
  const orderId = params.get("orderId") ?? "";
  const paid = params.get("paid") === "1";

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">
        {paid ? "支付成功" : "支付处理中"}
      </h1>
      <p className="text-sm text-muted-foreground">
        {paid
          ? "额度已入账，可返回继续使用。"
          : "若已完成付款，请稍候刷新；系统会通过支付宝异步通知自动入账。"}
      </p>
      {orderId ? (
        <p className="font-mono text-xs text-muted-foreground">
          订单号：{orderId}
        </p>
      ) : null}
      <Link
        href="/organizer/dashboard"
        className="mt-2 text-sm underline underline-offset-4"
      >
        返回控制台
      </Link>
    </main>
  );
}

export default function BillingResultPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto flex min-h-[60vh] items-center justify-center px-6">
          加载中…
        </main>
      }
    >
      <BillingResultInner />
    </Suspense>
  );
}
