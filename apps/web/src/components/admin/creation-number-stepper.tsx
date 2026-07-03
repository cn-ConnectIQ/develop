"use client";

import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export type CreationNumberStepperProps = {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  className?: string;
};

/** Mentimeter 式大号数字步进器 */
export function CreationNumberStepper({
  value,
  onChange,
  min = 1,
  max,
  step = 1,
  disabled,
  className,
}: CreationNumberStepperProps) {
  function decrement() {
    onChange(Math.max(min, value - step));
  }

  function increment() {
    const next = value + step;
    onChange(max != null ? Math.min(max, next) : next);
  }

  return (
    <div
      className={cn(
        "inline-flex items-center gap-0.5 rounded-xl border border-border-light bg-content-bg/40",
        className,
      )}
    >
      <button
        type="button"
        disabled={disabled || value <= min}
        onClick={decrement}
        className="flex size-11 items-center justify-center rounded-l-xl text-text-muted transition-colors hover:bg-white hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40"
        aria-label="减少"
      >
        <Minus className="size-4" />
      </button>
      <span className="min-w-[3.5rem] px-2 text-center text-xl font-semibold tabular-nums">
        {value}
      </span>
      <button
        type="button"
        disabled={disabled || (max != null && value >= max)}
        onClick={increment}
        className="flex size-11 items-center justify-center rounded-r-xl text-text-muted transition-colors hover:bg-white hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40"
        aria-label="增加"
      >
        <Plus className="size-4" />
      </button>
    </div>
  );
}
