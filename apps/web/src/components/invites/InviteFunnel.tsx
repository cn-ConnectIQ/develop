"use client";

import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

type InviteFunnelProps = {
  sent: number;
  delivered: number;
  clicked: number;
  activated: number;
  className?: string;
};

export function InviteFunnel({
  sent,
  delivered,
  clicked,
  activated,
  className,
}: InviteFunnelProps) {
  const activationRate =
    sent > 0 ? Math.round((activated / sent) * 1000) / 10 : 0;

  const steps = [
    { label: "已发送", value: sent, color: "text-brand-blue" },
    { label: "已送达", value: delivered, color: "text-brand-blue" },
    { label: "已点击", value: clicked, color: "text-brand-green" },
    { label: "已激活", value: activated, color: "text-brand-green" },
  ];

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border-light bg-white p-5",
        className,
      )}
    >
      <div className="flex flex-1 flex-wrap items-center gap-2 sm:gap-4">
        {steps.map((step, index) => (
          <div key={step.label} className="flex items-center gap-2 sm:gap-4">
            <div className="text-center">
              <p className={cn("text-2xl font-semibold tabular-nums", step.color)}>
                {step.value}
              </p>
              <p className="text-xs text-text-muted">{step.label}</p>
            </div>
            {index < steps.length - 1 && (
              <ArrowRight className="size-4 text-text-tertiary" />
            )}
          </div>
        ))}
      </div>
      <div className="text-right">
        <p className="text-xs text-text-muted">总激活率</p>
        <p className="text-3xl font-bold text-brand-green">{activationRate}%</p>
      </div>
    </div>
  );
}
