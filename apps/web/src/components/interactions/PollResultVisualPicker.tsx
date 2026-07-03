"use client";

import { BarChart2, Cloud, PieChart } from "lucide-react";
import {
  POLL_RESULT_VISUAL_OPTIONS,
  type PollResultVisual,
} from "@/lib/bigscreen-display";
import { cn } from "@/lib/utils";

const ICONS: Record<PollResultVisual, typeof BarChart2> = {
  race_bar: BarChart2,
  word_cloud: Cloud,
  distribution: PieChart,
};

type PollResultVisualPickerProps = {
  value: PollResultVisual;
  onChange: (value: PollResultVisual) => void;
  disabled?: boolean;
};

export function PollResultVisualPicker({
  value,
  onChange,
  disabled,
}: PollResultVisualPickerProps) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {POLL_RESULT_VISUAL_OPTIONS.map((opt) => {
        const Icon = ICONS[opt.value];
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            disabled={disabled}
            onClick={() => onChange(opt.value)}
            className={cn(
              "flex flex-col items-start rounded-xl border-2 px-4 py-3 text-left transition-colors",
              active
                ? "border-brand-blue bg-brand-blue-light/15 ring-1 ring-brand-blue/30"
                : "border-border-light hover:border-border-default hover:bg-content-bg/50",
              disabled && "cursor-not-allowed opacity-50",
            )}
          >
            <Icon
              className={cn(
                "mb-2 size-5",
                active ? "text-brand-blue" : "text-text-muted",
              )}
            />
            <span className="text-sm font-semibold">{opt.label}</span>
            <span className="mt-0.5 text-xs leading-snug text-text-muted">
              {opt.description}
            </span>
          </button>
        );
      })}
    </div>
  );
}
