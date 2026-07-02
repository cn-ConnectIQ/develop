"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";

export default function StampRallyError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[stamp-rally] page error:", error);
  }, [error]);

  return (
    <div className="flex min-h-[420px] flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <h1 className="text-lg font-semibold text-[var(--admin-ink)]">
        集章打卡页面加载失败
      </h1>
      <p className="max-w-md text-sm text-text-muted">
        可能是数据库连接暂时不可用，或 Preview 环境尚未同步最新 schema。
        请稍后重试；若持续出现，请检查 Vercel 环境变量与数据库迁移。
      </p>
      {process.env.NODE_ENV === "development" && error.message && (
        <p className="max-w-lg break-all text-xs text-destructive">
          {error.message}
        </p>
      )}
      {error.digest && (
        <p className="text-xs text-text-tertiary">错误 ID: {error.digest}</p>
      )}
      <div className="flex flex-wrap justify-center gap-3">
        <Button onClick={() => reset()}>重试</Button>
        <Link href="/events" className={buttonVariants({ variant: "outline" })}>
          返回活动列表
        </Link>
      </div>
    </div>
  );
}
