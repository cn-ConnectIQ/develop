import type { ReactNode } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";

export type StatMetricTrend = {
  direction: "up" | "down";
  label: string;
};

type StatMetricCardProps = {
  label: string;
  children: ReactNode;
  trend?: StatMetricTrend;
  footer?: ReactNode;
  className?: string;
};

/** 数据概览统计卡片：留白 + 字体层级，无渐变/发光 */
export function StatMetricCard({
  label,
  children,
  trend,
  footer,
  className,
}: StatMetricCardProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-surface p-6 shadow-sm",
        className,
      )}
    >
      <p className="text-sm text-text-secondary">{label}</p>
      <div className="mt-2">{children}</div>
      {trend ? (
        <p
          className={cn(
            "mt-3 flex items-center gap-1 text-xs font-medium",
            trend.direction === "up" ? "text-brand-green" : "text-brand-red",
          )}
        >
          {trend.direction === "up" ? (
            <ArrowUp className="size-3 shrink-0" aria-hidden />
          ) : (
            <ArrowDown className="size-3 shrink-0" aria-hidden />
          )}
          {trend.label}
        </p>
      ) : null}
      {footer ? (
        <div className="mt-3 text-sm text-text-secondary">{footer}</div>
      ) : null}
    </div>
  );
}

type StatMetricValueProps = {
  value: ReactNode;
  /** 默认 text-primary；关键指标可用 text-brand-green */
  tone?: "primary" | "brand";
  suffix?: ReactNode;
  className?: string;
};

export function StatMetricValue({
  value,
  tone = "primary",
  suffix,
  className,
}: StatMetricValueProps) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-1 gap-y-0.5">
      <span
        className={cn(
          "text-3xl font-bold tabular-nums leading-tight",
          tone === "brand" ? "text-brand-green" : "text-text-primary",
          className,
        )}
      >
        {value}
      </span>
      {suffix ? (
        <span className="text-lg font-medium text-text-secondary">{suffix}</span>
      ) : null}
    </div>
  );
}

export function parseConnectionsTrend(delta: string): StatMetricTrend | undefined {
  if (delta.startsWith("↑")) {
    return { direction: "up", label: delta.replace(/^↑\s*/, "") };
  }
  if (delta.startsWith("↓")) {
    return { direction: "down", label: delta.replace(/^↓\s*/, "") };
  }
  return undefined;
}
