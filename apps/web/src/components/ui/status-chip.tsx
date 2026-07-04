import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type StatusChipVariant =
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "neutral"
  | "purple";

const VARIANT_STYLES: Record<StatusChipVariant, string> = {
  success: "bg-brand-green-soft text-brand-green",
  warning: "bg-brand-amber-light text-brand-amber",
  danger: "bg-brand-red-light text-brand-red",
  info: "bg-brand-blue-light text-brand-blue",
  neutral: "bg-surface-secondary text-text-secondary",
  purple: "bg-ai-purple-soft text-ai-purple",
};

const DOT_STYLES: Record<StatusChipVariant, string> = {
  success: "bg-brand-green",
  warning: "bg-brand-amber",
  danger: "bg-brand-red",
  info: "bg-brand-blue",
  neutral: "bg-text-tertiary",
  purple: "bg-ai-purple",
};

type StatusChipProps = {
  children: ReactNode;
  variant?: StatusChipVariant;
  dot?: boolean;
  className?: string;
};

/** MODERN-04：状态类文字统一 chip 呈现 */
export function StatusChip({
  children,
  variant = "neutral",
  dot = false,
  className,
}: StatusChipProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-sm px-2 py-0.5 text-xs font-medium",
        VARIANT_STYLES[variant],
        className,
      )}
    >
      {dot && (
        <span className={cn("size-1.5 shrink-0 rounded-full", DOT_STYLES[variant])} />
      )}
      {children}
    </span>
  );
}
