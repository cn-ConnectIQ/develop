"use client";

import { Check } from "lucide-react";
import { BigScreenAnimationType } from "@/lib/lottery/big-screen-animation-config";
import {
  ANIMATION_TYPE_OPTIONS,
  type AnimationTypeValue,
} from "@/lib/lottery/probability-lottery-config";
import {
  BIG_SCREEN_ANIMATION_OPTIONS,
  type BigScreenAnimationTypeValue,
} from "@/lib/lottery/big-screen-animation-config";
import { cn } from "@/lib/utils";

export type AnimationTypePickerProps = {
  value: AnimationTypeValue;
  onChange: (value: AnimationTypeValue) => void;
};

export type BigScreenAnimationTypePickerProps = {
  value: BigScreenAnimationTypeValue;
  onChange: (value: BigScreenAnimationTypeValue) => void;
};

function ParticipantAnimationPreview({
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

/** 参与人概率抽奖动效（WHEEL / GRID / SLOT 等） */
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
            <ParticipantAnimationPreview type={option.value} active={selected} />
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

function RollingMachineThumbnail({ active }: { active?: boolean }) {
  return (
    <div className="relative flex h-[120px] items-center justify-center overflow-hidden bg-[#1A1A2E]">
      <div
        className={cn(
          "relative flex h-[88px] w-[60px] flex-col items-center justify-center overflow-hidden rounded-xl border border-white/15",
          "bg-gradient-to-b from-[#2A2A50] to-[#1A1A35]",
          active && "shadow-[0_0_20px_rgba(83,74,183,0.45)]",
        )}
      >
        {["王", "陈", "赵"].map((char, i) => (
          <div
            key={char}
            className={cn(
              "flex size-6 items-center justify-center rounded-full text-[9px] font-extrabold text-[#534AB7]",
              "bg-[radial-gradient(circle_at_35%_35%,#fff,#D4D0FF)]",
              active && "animate-ciq-slot-float",
            )}
            style={active ? { animationDelay: `${i * 0.25}s` } : undefined}
          >
            {char}
          </div>
        ))}
      </div>
    </div>
  );
}

function SpotlightScrollThumbnail({ active }: { active?: boolean }) {
  const names = ["王磊 · 恒光", "陈静 · 星图", "赵敏 · 云拓", "李强 · 智链"];
  return (
    <div className="flex h-[120px] flex-col items-center justify-center gap-1 bg-[#1A1A2E]">
      {names.map((name, i) => (
        <span
          key={name}
          className={cn(
            "text-[10px] text-white/50",
            i === 2 && "text-sm font-extrabold text-brand-gold",
            active && i !== 2 && "animate-pulse",
          )}
        >
          {name}
        </span>
      ))}
    </div>
  );
}

function ReelOfHonorThumbnail({ active }: { active?: boolean }) {
  return (
    <div className="flex h-[120px] items-center justify-center bg-[#1A1A2E]">
      <div className="relative">
        <div
          className={cn(
            "size-[72px] rounded-full border-2 border-brand-gold/60",
            "bg-[conic-gradient(#EF9F27_0_72deg,#0F6E56_72deg_144deg,#C77A1B_144deg_216deg,#EF9F27_216deg_288deg,#0F6E56_288deg_360deg)]",
            active && "animate-spin",
          )}
          style={{ animationDuration: "4s" }}
        />
        <span className="absolute inset-0 flex items-center justify-center text-lg">
          🏆
        </span>
      </div>
    </div>
  );
}

function StarlightOrbitThumbnail({ active }: { active?: boolean }) {
  return (
    <div className="relative flex h-[120px] items-center justify-center bg-[#0D1117]">
      <div className="relative size-16">
        <div className="absolute inset-0 rounded-full border border-cyan-400/30" />
        {[0, 120, 240].map((deg) => (
          <span
            key={deg}
            className={cn(
              "absolute left-1/2 top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee]",
              active && "animate-pulse",
            )}
            style={{
              transform: `rotate(${deg}deg) translateY(-28px)`,
            }}
          />
        ))}
        <span className="absolute left-1/2 top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/90" />
      </div>
    </div>
  );
}

function PrecisionRollerThumbnail({ active }: { active?: boolean }) {
  return (
    <div className="flex h-[120px] items-center justify-center gap-1.5 bg-[#1A1A2E]">
      {["3", "2", "8"].map((digit) => (
        <div
          key={digit}
          className={cn(
            "flex h-12 w-8 items-center justify-center rounded-md border border-white/15 bg-[#2A2A50] font-mono text-lg font-bold text-white",
            active && "animate-ciq-slot-drop",
          )}
        >
          {digit}
        </div>
      ))}
    </div>
  );
}

function ScrollUnveilingThumbnail({ active }: { active?: boolean }) {
  return (
    <div className="flex h-[120px] items-center justify-center bg-[#1A1A2E] px-4">
      <div className="relative h-14 w-full max-w-[140px] overflow-hidden rounded-lg border border-amber-700/40 bg-gradient-to-r from-amber-900/40 via-amber-800/30 to-amber-900/40">
        <div
          className={cn(
            "absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-amber-600/50 to-transparent",
            active && "animate-pulse",
          )}
        />
        <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-amber-200">
          揭榜
        </span>
      </div>
    </div>
  );
}

function BigScreenAnimationThumbnail({
  type,
  active,
}: {
  type: BigScreenAnimationTypeValue;
  active?: boolean;
}) {
  switch (type) {
    case BigScreenAnimationType.ROLLING_MACHINE:
      return <RollingMachineThumbnail active={active} />;
    case BigScreenAnimationType.SPOTLIGHT_SCROLL:
      return <SpotlightScrollThumbnail active={active} />;
    case BigScreenAnimationType.REEL_OF_HONOR:
      return <ReelOfHonorThumbnail active={active} />;
    case BigScreenAnimationType.STARLIGHT_ORBIT:
      return <StarlightOrbitThumbnail active={active} />;
    case BigScreenAnimationType.PRECISION_ROLLER:
      return <PrecisionRollerThumbnail active={active} />;
    case BigScreenAnimationType.SCROLL_UNVEILING:
      return <ScrollUnveilingThumbnail active={active} />;
    default:
      return <RollingMachineThumbnail active={active} />;
  }
}

/** POOL_DRAW 大屏全场抽奖动效（6 选 1，写入 big_screen_animation_type） */
export function BigScreenAnimationTypePicker({
  value,
  onChange,
}: BigScreenAnimationTypePickerProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
      {BIG_SCREEN_ANIMATION_OPTIONS.map((option) => {
        const selected = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              "overflow-hidden rounded-[14px] border-2 text-left transition-all",
              selected
                ? "border-brand-green shadow-[0_4px_16px_rgba(15,110,86,0.15)]"
                : "border-border-light hover:border-brand-green/30",
            )}
          >
            <div className="relative">
              {selected && (
                <span className="absolute right-2 top-2 z-10 flex size-6 items-center justify-center rounded-full bg-brand-green">
                  <Check className="size-3.5 text-white" strokeWidth={3} />
                </span>
              )}
              <BigScreenAnimationThumbnail type={option.value} active={selected} />
            </div>
            <div className="bg-white px-3 py-2.5 sm:px-4 sm:py-3">
              <p className="text-sm font-bold text-text-primary">{option.title}</p>
              <p className="mt-0.5 text-xs text-text-muted">「{option.tagline}」</p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
