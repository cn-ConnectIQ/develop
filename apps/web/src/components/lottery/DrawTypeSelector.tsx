"use client";

import { Clock, Hand, Zap } from "lucide-react";
import { LotteryDrawType } from "@/lib/lottery/lottery-enums";
import { cn } from "@/lib/utils";

export type DrawTypeSelectorProps = {
  value: LotteryDrawType;
  onChange: (value: LotteryDrawType) => void;
  drawAt?: string;
  onDrawAtChange?: (value: string) => void;
};

const OPTIONS = [
  {
    value: LotteryDrawType.INSTANT,
    icon: Zap,
    title: "即时开奖",
    description: "扫码参与 → 立即知道结果",
    accent: "border-brand-amber bg-brand-amber-light/30",
    iconClass: "text-brand-amber",
  },
  {
    value: LotteryDrawType.SCHEDULED,
    icon: Clock,
    title: "定时开奖",
    description: "设置具体时间，全体参与者一起开",
    accent: "border-brand-blue bg-brand-blue-light/30",
    iconClass: "text-brand-blue",
  },
  {
    value: LotteryDrawType.MANUAL,
    icon: Hand,
    title: "手动触发",
    description: "展商现场决定何时开奖，可配合大屏",
    accent: "border-brand-purple bg-brand-purple/10",
    iconClass: "text-brand-purple",
  },
] as const;

export function DrawTypeSelector({
  value,
  onChange,
  drawAt,
  onDrawAtChange,
}: DrawTypeSelectorProps) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        {OPTIONS.map((option) => {
          const selected = value === option.value;
          const Icon = option.icon;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={cn(
                "rounded-xl border-2 p-4 text-left transition-all",
                selected
                  ? option.accent
                  : "border-border-light bg-white hover:border-brand-blue/30",
              )}
            >
              <div
                className={cn(
                  "mb-3 flex size-10 items-center justify-center rounded-lg bg-white shadow-sm",
                  option.iconClass,
                )}
              >
                <Icon className="size-5" />
              </div>
              <p className="text-sm font-semibold">{option.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-text-muted">
                {option.description}
              </p>
            </button>
          );
        })}
      </div>

      {value === LotteryDrawType.SCHEDULED && (
        <div className="rounded-xl border border-border-light bg-white p-4">
          <label className="text-xs font-medium text-text-muted">
            开奖时间
          </label>
          <input
            type="datetime-local"
            className="mt-2 flex h-9 w-full max-w-sm rounded-md border border-border-light px-3 text-sm"
            value={drawAt ?? ""}
            onChange={(e) => onDrawAtChange?.(e.target.value)}
          />
        </div>
      )}
    </div>
  );
}
