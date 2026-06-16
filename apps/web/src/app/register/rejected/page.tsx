"use client";

import { Loader2, XCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

type ApplicationData = {
  status: string;
  rejectionReason: string | null;
};

export default function RegisterRejectedPage() {
  const router = useRouter();
  const [application, setApplication] = useState<ApplicationData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/applications/organizer/me");
        if (res.status === 401) {
          router.replace("/register/admin");
          return;
        }
        if (!res.ok) {
          router.replace("/register/admin");
          return;
        }
        const json = await res.json();
        const apps = (Array.isArray(json.data) ? json.data : []) as ApplicationData[];

        if (apps.length === 0) {
          router.replace("/register/admin");
          return;
        }

        const rejected = apps.find((a) => a.status === "REJECTED");
        if (!rejected) {
          if (apps.some((a) => a.status === "PENDING")) {
            router.replace("/register/pending");
          } else if (apps.some((a) => a.status === "APPROVED")) {
            router.replace("/events");
          } else {
            router.replace("/register/admin");
          }
          return;
        }

        setApplication(rejected);
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-8 animate-spin text-brand-blue" />
      </div>
    );
  }

  return (
    <div className="mx-auto mt-24 max-w-[480px] px-4">
      <div className="rounded-2xl border border-brand-red-light bg-white p-10">
        <XCircle
          className="mx-auto size-16 text-brand-red"
          strokeWidth={1.5}
        />
        <h1 className="mt-6 text-center text-2xl font-bold text-[var(--admin-ink)]">
          申请未通过
        </h1>

        <div className="mt-6 rounded-xl border border-brand-red/20 bg-brand-red-light p-4">
          <p className="text-sm font-medium text-brand-red">拒绝原因：</p>
          <p className="mt-1 text-sm text-brand-red/80">
            {application?.rejectionReason ||
              "未提供具体原因，请联系客服了解详情。"}
          </p>
        </div>

        <p className="mt-4 text-center text-sm text-text-muted">
          你可以修改申请信息后重新提交
        </p>

        <Button
          type="button"
          className="mt-6 h-11 w-full rounded-xl bg-brand-blue hover:bg-[#14538f]"
          onClick={() => router.push("/register/admin?step=2")}
        >
          修改并重新提交
        </Button>

        <a
          href="mailto:support@connectiq.com"
          className="mt-2 flex h-11 w-full items-center justify-center rounded-xl border border-border-light bg-white text-sm font-medium text-[var(--admin-ink)] transition-colors hover:bg-[#faf9f6]"
        >
          联系客服
        </a>

        <p className="mt-4 text-center">
          <Link href="/login" className="text-sm text-brand-blue hover:underline">
            返回登录
          </Link>
        </p>
      </div>
    </div>
  );
}
