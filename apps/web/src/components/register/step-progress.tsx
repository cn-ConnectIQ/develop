"use client";

import { cn } from "@/lib/utils";

const STEPS = ["账号信息", "组织信息", "确认提交"] as const;

type StepProgressProps = {
  currentStep: 1 | 2 | 3;
  /** 追加新组织：仅显示组织信息 + 确认提交两步 */
  mode?: "default" | "add";
};

export function StepProgress({ currentStep, mode = "default" }: StepProgressProps) {
  const steps =
    mode === "add"
      ? (["组织信息", "确认提交"] as const)
      : STEPS;

  const displayStep =
    mode === "add"
      ? currentStep === 2
        ? 1
        : currentStep === 3
          ? 2
          : 1
      : currentStep;

  return (
    <div className="mb-10 flex items-center justify-between">
      {steps.map((label, index) => {
        const stepNumber = (index + 1) as 1 | 2 | 3;
        const isCompleted = stepNumber < displayStep;
        const isCurrent = stepNumber === displayStep;

        return (
          <div key={label} className="flex flex-1 items-center">
            <div className="flex flex-col items-center gap-2">
              <div
                className={cn(
                  "flex size-8 items-center justify-center rounded-full border-2 text-sm font-medium transition-colors",
                  isCompleted && "border-brand-blue bg-brand-blue text-white",
                  isCurrent &&
                    "border-brand-blue bg-white text-brand-blue",
                  !isCompleted &&
                    !isCurrent &&
                    "border-border-light bg-white text-text-muted",
                )}
              >
                {isCompleted ? "✓" : stepNumber}
              </div>
              <span
                className={cn(
                  "text-xs font-medium",
                  isCurrent ? "text-brand-blue" : "text-text-muted",
                )}
              >
                {label}
              </span>
            </div>
            {index < steps.length - 1 && (
              <div
                className={cn(
                  "mx-2 mb-6 h-0.5 flex-1",
                  stepNumber < displayStep
                    ? "bg-brand-blue"
                    : "bg-border-light",
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
