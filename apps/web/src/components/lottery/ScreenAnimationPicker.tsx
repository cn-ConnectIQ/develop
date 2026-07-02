"use client";

import type { ScreenAnimationType } from "@/lib/lottery/organizer-lottery-config";
import { SCREEN_ANIMATION_OPTIONS } from "@/lib/lottery/organizer-lottery-config";
import { cn } from "@/lib/utils";

export type ScreenAnimationPickerProps = {
  value: ScreenAnimationType;
  onChange: (value: ScreenAnimationType) => void;
};

export function ScreenAnimationPicker({
  value,
  onChange,
}: ScreenAnimationPickerProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {SCREEN_ANIMATION_OPTIONS.map((option) => {
        const selected = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              "rounded-xl border-2 p-4 text-left transition-all",
              selected
                ? "border-brand-blue bg-brand-blue-light/40"
                : "border-border-light bg-white hover:border-brand-blue/30",
            )}
          >
            <span className="text-3xl">{option.emoji}</span>
            <p className="mt-2 text-sm font-semibold">{option.title}</p>
            <p className="mt-1 text-xs leading-relaxed text-text-muted">
              {option.description}
            </p>
          </button>
        );
      })}
    </div>
  );
}
