"use client";

import { Clock, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

type ApplicationData = {
  status: string;
  orgName: string;
  accountTypeLabel: string;
  contactEmail: string;
  submittedAt: string;
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function RegisterPendingPage() {
  const router = useRouter();
  const [application, setApplication] = useState<ApplicationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStatus = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    try {
      const res = await fetch("/api/applications/organizer/me");
      if (res.status === 401) {
        router.replace("/register/admin");
        return;
      }
      if (res.status === 404) {
        router.replace("/register/admin");
        return;
      }
      if (!res.ok) return;

      const json = await res.json();
      const apps = (Array.isArray(json.data) ? json.data : []) as ApplicationData[];

      if (apps.length === 0) {
        router.replace("/register/admin");
        return;
      }

      const pending = apps.find((a) => a.status === "PENDING");
      if (!pending) {
        if (apps.some((a) => a.status === "REJECTED")) {
          router.replace("/register/rejected");
        } else if (apps.some((a) => a.status === "APPROVED")) {
          router.replace("/events");
        } else {
          router.replace("/register/admin");
        }
        return;
      }

      const data = pending;
      setApplication(data);
    } finally {
      setLoading(false);
      if (manual) setRefreshing(false);
    }
  }, [router]);

  useEffect(() => {
    void fetchStatus();
    const timer = setInterval(() => void fetchStatus(), 30_000);
    return () => clearInterval(timer);
  }, [fetchStatus]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-8 animate-spin text-brand-blue" />
      </div>
    );
  }

  return (
    <div className="mx-auto mt-24 max-w-[480px] px-4">
      <div className="rounded-2xl border border-border-light bg-white p-10">
        <Clock className="mx-auto size-16 text-brand-amber" strokeWidth={1.5} />
        <h1 className="mt-6 text-center text-2xl font-bold text-[var(--admin-ink)]">
          申请已提交
        </h1>
        <p className="mt-2 text-center text-text-muted">
          预计 1-3 个工作日内完成审核
        </p>

        {application && (
          <div className="mt-6 space-y-2 rounded-xl bg-content-bg p-4 text-sm">
            <div className="flex justify-between">
              <span className="text-text-muted">组织名</span>
              <span className="font-medium">{application.orgName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">联系邮箱</span>
              <span className="font-medium">{application.contactEmail}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">提交时间</span>
              <span className="font-medium">
                {formatDate(application.submittedAt)}
              </span>
            </div>
          </div>
        )}

        <p className="mt-4 text-center text-sm text-text-muted">
          审核结果将通过短信和邮件通知你
        </p>

        <Button
          type="button"
          variant="outline"
          className="mx-auto mt-4 flex h-10 rounded-xl px-6"
          disabled={refreshing}
          onClick={() => void fetchStatus(true)}
        >
          {refreshing ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              刷新中...
            </>
          ) : (
            "刷新状态"
          )}
        </Button>

        <p className="mt-2 text-center">
          <Link href="/login" className="text-sm text-brand-blue hover:underline">
            返回登录
          </Link>
        </p>
      </div>
    </div>
  );
}
