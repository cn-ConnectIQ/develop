"use client";

import { cn } from "@/lib/utils";

export function EventReviewBanner() {
  return (
    <div className="fixed top-14 right-0 left-0 z-40 border-b border-brand-amber/30 bg-brand-amber-light px-4 py-2.5 text-center text-sm text-brand-amber lg:left-[240px]">
      ⏳ 此活动正在审核中，部分功能暂时锁定，审核通过后将自动解锁
    </div>
  );
}

export function LockedOverlay({
  locked,
  tooltip = "审核通过后可用",
  children,
  className,
}: {
  locked: boolean;
  tooltip?: string;
  children: React.ReactNode;
  className?: string;
}) {
  if (!locked) return <>{children}</>;

  return (
    <div className={cn("relative", className)} title={tooltip}>
      <div className="pointer-events-none opacity-50 grayscale">{children}</div>
      <div className="absolute inset-0 cursor-not-allowed bg-white/40" />
    </div>
  );
}
