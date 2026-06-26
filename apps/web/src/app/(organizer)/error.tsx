"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function OrganizerError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[organizer] page error:", error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-content-bg px-6 text-center">
      <h1 className="text-lg font-semibold text-[var(--admin-ink)]">
        页面加载失败
      </h1>
      <p className="max-w-md text-sm text-text-muted">
        登录成功，但活动列表暂时无法加载。常见原因是 Preview 环境未配置数据库或 schema
        未同步。请稍后重试，或联系管理员检查 Vercel 环境变量与数据库迁移。
      </p>
      {error.digest && (
        <p className="text-xs text-text-tertiary">错误 ID: {error.digest}</p>
      )}
      <div className="flex gap-3">
        <Button onClick={() => reset()}>重试</Button>
        <Button variant="outline" onClick={() => window.location.assign("/login")}>
          返回登录
        </Button>
      </div>
    </div>
  );
}
