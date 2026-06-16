import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function AccountSuspendedPage() {
  return (
    <div className="flex min-h-screen flex-1 items-start justify-center bg-content-bg px-4">
      <div className="mx-auto mt-32 max-w-md text-center">
        <AlertTriangle className="mx-auto size-16 text-brand-red" />
        <h1 className="mt-6 text-2xl font-bold text-[var(--admin-ink)]">
          账号已被暂停
        </h1>
        <p className="mt-2 text-text-muted">如有疑问，请联系平台客服</p>
        <div className="mt-6 space-y-1 text-sm text-text-muted">
          <p>
            邮箱：
            <a
              href="mailto:support@connectiq.com"
              className="text-brand-blue hover:underline"
            >
              support@connectiq.com
            </a>
          </p>
          <p>
            电话：
            <a href="tel:400-888-0000" className="text-brand-blue hover:underline">
              400-888-0000
            </a>
          </p>
        </div>
        <div className="mt-6">
          <Link
            href="/login"
            className={cn(buttonVariants({ variant: "outline" }))}
          >
            返回登录
          </Link>
        </div>
      </div>
    </div>
  );
}
