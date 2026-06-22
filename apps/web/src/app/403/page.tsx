"use client";

import Link from "next/link";
import { ShieldOff } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { clearAuthRoleCookies, signOutWithCleanup } from "@/lib/auth-redirect";
import { cn } from "@/lib/utils";

export default function ForbiddenPage() {
  async function backToLogin() {
    clearAuthRoleCookies();
    try {
      await signOutWithCleanup("/login");
    } catch {
      window.location.href = `${window.location.origin}/login`;
    }
  }

  return (
    <div className="flex min-h-screen flex-1 items-start justify-center bg-content-bg px-4">
      <div className="mx-auto mt-32 max-w-md text-center">
        <ShieldOff className="mx-auto size-16 text-text-muted/40" />
        <h1 className="mt-6 text-2xl font-bold text-[var(--admin-ink)]">
          没有访问权限
        </h1>
        <p className="mt-2 text-text-muted">
          ConnectIQ 管理后台仅对已审核通过的账号管理员开放
        </p>
        <p className="mt-1 text-sm text-text-muted">
          如果你是参会者或最终用户，请使用微信小程序
        </p>
        <p className="mt-3 text-xs text-text-tertiary">
          请使用管理员测试账号重新登录（003 展览主办方 / 密码 ConnectIQ2024!）
        </p>
        <Link
          href="#"
          className="mt-4 inline-block text-sm text-brand-blue hover:underline"
        >
          扫码下载小程序
        </Link>
        <div className="mt-4">
          <button
            type="button"
            className={cn(buttonVariants({ variant: "outline" }))}
            onClick={() => void backToLogin()}
          >
            退出并重新登录
          </button>
        </div>
      </div>
    </div>
  );
}
