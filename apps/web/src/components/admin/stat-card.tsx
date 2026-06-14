import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type StatCardProps = {
  label: string;
  value: string | number;
  hint?: string;
  trend?: { value: string; positive?: boolean };
  accent?: "blue" | "green" | "purple" | "amber";
  className?: string;
};

const accentMap = {
  blue: "text-brand-blue",
  green: "text-brand-green",
  purple: "text-brand-purple",
  amber: "text-brand-amber",
};

export function StatCard({
  label,
  value,
  hint,
  trend,
  accent = "blue",
  className,
}: StatCardProps) {
  return (
    <div className={cn("admin-card admin-card-pad-lg", className)}>
      <p className="mb-2 flex items-center gap-1.5 text-[12.5px] text-[var(--admin-gray)]">
        {label}
      </p>
      <p className={cn("admin-metric-num", accentMap[accent])}>{value}</p>
      {(hint || trend) && (
        <div className="mt-2 flex items-center gap-2 text-[12px] text-text-tertiary">
          {trend && (
            <span
              className={cn(
                "font-medium",
                trend.positive ? "text-brand-green" : "text-brand-red",
              )}
            >
              {trend.value}
            </span>
          )}
          {hint && <span>{hint}</span>}
        </div>
      )}
    </div>
  );
}

type StatGridProps = {
  children: ReactNode;
  columns?: 2 | 3 | 4 | 5;
};

export function StatGrid({ children, columns = 4 }: StatGridProps) {
  const cols =
    columns === 2
      ? "sm:grid-cols-2"
      : columns === 3
        ? "sm:grid-cols-2 lg:grid-cols-3"
        : columns === 5
          ? "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
          : "sm:grid-cols-2 lg:grid-cols-4";

  return (
    <div className={cn("grid grid-cols-1 gap-4", cols)}>{children}</div>
  );
}
