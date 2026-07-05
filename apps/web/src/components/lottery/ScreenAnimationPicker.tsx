"use client";

import { Check } from "lucide-react";
import {
  GRAND_SCREEN_ANIMATION_OPTIONS,
  SCREEN_ANIMATION_OPTIONS,
  type ScreenAnimationType,
} from "@/lib/lottery/organizer-lottery-config";
import { cn } from "@/lib/utils";

export type ScreenAnimationPickerProps = {
  value: ScreenAnimationType;
  onChange: (value: ScreenAnimationType) => void;
  /** grand = BS1 大屏二选一；all = 全部动效 */
  variant?: "grand" | "all";
};

function SlotMachineThumbnail({ active }: { active?: boolean }) {
  return (
    <div className="relative flex h-[140px] items-center justify-center overflow-hidden bg-[#1A1A2E]">
      <div
        className={cn(
          "relative flex h-[100px] w-[70px] flex-col items-center justify-center overflow-hidden rounded-xl border border-white/15",
          "bg-gradient-to-b from-[#2A2A50] to-[#1A1A35]",
          active && "shadow-[0_0_24px_rgba(83,74,183,0.45)]",
        )}
      >
        <div className="absolute inset-x-0 top-0 h-1/2 rounded-t-xl bg-gradient-to-b from-white/10 to-transparent" />
        <div className="relative z-10 flex flex-col items-center gap-2">
          {["王", "陈", "赵"].map((char, i) => (
            <div
              key={char}
              className={cn(
                "flex size-7 items-center justify-center rounded-full text-[10px] font-extrabold text-[#534AB7]",
                "bg-[radial-gradient(circle_at_35%_35%,#fff,#D4D0FF)] shadow-md",
                active && "animate-ciq-slot-float",
              )}
              style={active ? { animationDelay: `${i * 0.25}s` } : undefined}
            >
              {char}
            </div>
          ))}
        </div>
        <div className="absolute bottom-0 h-2 w-10 rounded-b-md border-t border-white/15 bg-[#0A0A1A]" />
      </div>
      {active && (
        <div className="absolute bottom-5 flex size-8 animate-ciq-slot-drop items-center justify-center rounded-full bg-[radial-gradient(circle_at_35%_35%,#fff,#D4D0FF)] text-[10px] font-extrabold text-[#534AB7] shadow-[0_0_16px_rgba(83,74,183,0.6)]">
          李
        </div>
      )}
    </div>
  );
}

function ScrollListThumbnail({ active }: { active?: boolean }) {
  const names = ["王磊 · 恒光", "陈静 · 星图", "赵敏 · 云拓", "李强 · 智链"];
  return (
    <div className="relative flex h-[140px] items-center justify-center overflow-hidden bg-[#1A1A2E]">
      <div className="flex flex-col items-center gap-1.5 opacity-80">
        {names.map((name, i) => (
          <span
            key={name}
            className={cn(
              "text-[10px] text-white/60",
              i === 2 &&
                "text-base font-extrabold text-brand-gold shadow-[0_0_10px_rgba(239,159,39,0.8)]",
              active && i !== 2 && "animate-pulse",
            )}
          >
            {name}
          </span>
        ))}
      </div>
    </div>
  );
}

function AnimationThumbnail({
  type,
  active,
}: {
  type: ScreenAnimationType;
  active?: boolean;
}) {
  if (type === "SLOT_MACHINE") return <SlotMachineThumbnail active={active} />;
  if (type === "REVEAL_ONE_BY_ONE") return <ScrollListThumbnail active={active} />;
  if (type === "WHEEL") {
    return (
      <div className="flex h-[140px] items-center justify-center bg-[#1A1A2E]">
        <div
          className={cn(
            "size-20 rounded-full",
            "bg-[conic-gradient(#0F6E56_0_60deg,#EF9F27_60deg_120deg,#C77A1B_120deg_180deg,#0F6E56_180deg_240deg,#EF9F27_240deg_300deg,#C77A1B_300deg_360deg)]",
            active && "animate-spin",
          )}
          style={{ animationDuration: "3s" }}
        />
      </div>
    );
  }
  return (
    <div className="relative flex h-[140px] items-center justify-center overflow-hidden bg-[#1A1A2E]">
      {["🧧", "🎁", "🧧"].map((emoji, i) => (
        <span
          key={i}
          className={cn("absolute text-2xl", active && "animate-bounce")}
          style={{
            left: `${20 + i * 30}%`,
            top: `${20 + i * 15}%`,
            animationDelay: `${i * 0.2}s`,
          }}
        >
          {emoji}
        </span>
      ))}
    </div>
  );
}

export function ScreenAnimationPicker({
  value,
  onChange,
  variant = "grand",
}: ScreenAnimationPickerProps) {
  const options =
    variant === "grand" ? GRAND_SCREEN_ANIMATION_OPTIONS : SCREEN_ANIMATION_OPTIONS;

  return (
    <div className={cn("grid gap-4", variant === "grand" ? "grid-cols-2" : "sm:grid-cols-2")}>
      {options.map((option) => {
        const selected = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value as ScreenAnimationType)}
            className={cn(
              "overflow-hidden rounded-[14px] border-2 text-left transition-all",
              selected
                ? "border-brand-green shadow-[0_4px_16px_rgba(15,110,86,0.15)]"
                : "border-border-light hover:border-brand-green/30",
            )}
          >
            <div className="relative">
              {selected && (
                <span className="absolute right-2.5 top-2.5 z-10 flex size-6 items-center justify-center rounded-full bg-brand-green">
                  <Check className="size-3.5 text-white" strokeWidth={3} />
                </span>
              )}
              <AnimationThumbnail
                type={option.value as ScreenAnimationType}
                active={selected}
              />
            </div>
            <div className="bg-white px-4 py-3">
              <p className="text-sm font-bold text-text-primary">
                {option.emoji} {option.title}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-text-muted">
                {option.description}
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
