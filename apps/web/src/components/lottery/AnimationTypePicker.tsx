"use client";

import {
  ANIMATION_TYPE_OPTIONS,
  type AnimationTypeValue,
} from "@/lib/lottery/probability-lottery-config";
import { cn } from "@/lib/utils";

export type AnimationTypePickerProps = {
  value: AnimationTypeValue;
  onChange: (value: AnimationTypeValue) => void;
};

function AnimationPreview({
  type,
  active,
}: {
  type: AnimationTypeValue;
  active: boolean;
}) {
  const option = ANIMATION_TYPE_OPTIONS.find((o) => o.value === type);

  if (type === "GRID") {
    return (
      <div className={cn("grid h-14 grid-cols-3 gap-0.5 rounded-md p-1", option?.previewClass)}>
        {Array.from({ length: 9 }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "rounded-sm bg-white/60",
              i === 4 && active && "bg-brand-gold",
            )}
          />
        ))}
      </div>
    );
  }

  if (type === "SLOT") {
    return (
      <div className={cn("flex h-14 items-center justify-center gap-1", option?.previewClass)}>
        {["🍒", "7️⃣", "🍋"].map((sym) => (
          <div
            key={sym}
            className="flex size-8 items-center justify-center rounded bg-white/70 text-sm"
          >
            {sym}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex h-14 items-center justify-center rounded-md text-2xl",
        option?.previewClass,
      )}
    >
      {option?.emoji}
    </div>
  );
}

export function AnimationTypePicker({
  value,
  onChange,
}: AnimationTypePickerProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {ANIMATION_TYPE_OPTIONS.map((option) => {
        const selected = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              "rounded-xl border-2 p-4 text-left transition-all",
              selected
                ? "border-brand-green bg-brand-green-light/30 ring-1 ring-brand-green/20"
                : "border-border-light bg-white hover:border-brand-green/40",
            )}
          >
            <AnimationPreview type={option.value} active={selected} />
            <p className="mt-3 text-sm font-semibold">
              {option.emoji} {option.title}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-text-muted">
              {option.description}
            </p>
          </button>
        );
      })}
    </div>
  );
}
