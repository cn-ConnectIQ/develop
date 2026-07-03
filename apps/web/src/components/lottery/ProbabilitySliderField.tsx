"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export type ProbabilitySliderFieldProps = {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
};

/**
 * 概率滑块：保留原生 range 数值逻辑，放大轨道与百分比反馈（拖动时数字跳动）
 */
export function ProbabilitySliderField({
  value,
  onChange,
  disabled,
}: ProbabilitySliderFieldProps) {
  const [bump, setBump] = useState(false);
  const prevRef = useRef(value);

  useEffect(() => {
    if (prevRef.current !== value) {
      setBump(true);
      prevRef.current = value;
      const timer = window.setTimeout(() => setBump(false), 220);
      return () => window.clearTimeout(timer);
    }
  }, [value]);

  return (
    <div>
      <div className="mb-3 flex items-end justify-between gap-4">
        <span className="text-sm font-medium text-text-muted">中奖概率</span>
        <span
          className={cn(
            "origin-right text-3xl font-bold tabular-nums text-brand-green transition-transform duration-200",
            bump && "scale-110",
          )}
        >
          {value.toFixed(1)}%
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        step={0.5}
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-3 w-full cursor-pointer appearance-none rounded-full bg-gray-200 accent-brand-green disabled:cursor-not-allowed disabled:opacity-50 [&::-moz-range-thumb]:size-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-brand-green [&::-moz-range-track]:h-3 [&::-moz-range-track]:rounded-full [&::-webkit-slider-thumb]:size-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-brand-green [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-runnable-track]:h-3 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-gray-200"
      />
    </div>
  );
}
