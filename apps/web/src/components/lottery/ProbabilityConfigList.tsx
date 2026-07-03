"use client";

import { Plus, Trash2 } from "lucide-react";
import { CreationNumberStepper } from "@/components/admin/creation-number-stepper";
import { PrizeImageDropzone } from "@/components/admin/prize-image-dropzone";
import { creationStyles } from "@/components/admin/content-creation-layout";
import { ProbabilitySliderField } from "@/components/lottery/ProbabilitySliderField";
import type { ProbabilityPrizeDraft } from "@/lib/lottery/probability-lottery-config";
import {
  remainingProbabilityPercent,
  sumProbabilityPercent,
} from "@/lib/lottery/probability-lottery-config";
import { cn } from "@/lib/utils";

export type ProbabilityConfigListProps = {
  prizes: ProbabilityPrizeDraft[];
  onChange: (prizes: ProbabilityPrizeDraft[]) => void;
};

export function ProbabilityConfigList({
  prizes,
  onChange,
}: ProbabilityConfigListProps) {
  const allocated = sumProbabilityPercent(prizes);
  const remaining = remainingProbabilityPercent(prizes);
  const overLimit = allocated > 100 + 1e-6;

  function updatePrize(index: number, patch: Partial<ProbabilityPrizeDraft>) {
    onChange(prizes.map((p, i) => (i === index ? { ...p, ...patch } : p)));
  }

  function addPrize() {
    onChange([
      ...prizes,
      {
        name: "新奖品",
        quantity: 10,
        probability_percent: Math.min(10, remaining),
        prize_type: "PHYSICAL",
      },
    ]);
  }

  return (
    <div className="space-y-6">
      <div
        className={cn(
          "rounded-xl px-5 py-4 text-base",
          overLimit
            ? "border border-red-200 bg-red-50 text-red-700"
            : "border border-brand-green/30 bg-brand-green-light/20 text-brand-green",
        )}
      >
        {overLimit ? (
          <span>
            概率总和 {allocated.toFixed(1)}% 超过 100%，请调整后再保存
          </span>
        ) : (
          <span>
            已分配概率 {allocated.toFixed(1)}% · 剩余 {remaining.toFixed(1)}%
            为「谢谢参与」
          </span>
        )}
      </div>

      <div className="space-y-2">
        {prizes.map((prize, index) => (
          <div
            key={index}
            className="space-y-5 border-t border-border-light py-8 first:border-t-0 first:pt-0"
          >
            <div className="flex items-start justify-between gap-3">
              <span className="text-sm font-medium text-text-muted">
                奖品 {index + 1}
              </span>
              {prizes.length > 1 && (
                <button
                  type="button"
                  className="text-text-tertiary hover:text-brand-red"
                  onClick={() => onChange(prizes.filter((_, i) => i !== index))}
                  aria-label="删除奖品"
                >
                  <Trash2 className="size-4" />
                </button>
              )}
            </div>

            <div className="grid gap-6 lg:grid-cols-[minmax(140px,200px)_1fr]">
              <PrizeImageDropzone
                compact
                imageUrl={prize.image_url}
                alt={prize.name}
                onUpload={(url) => updatePrize(index, { image_url: url })}
              />

              <div className="space-y-5">
                <input
                  type="text"
                  value={prize.name}
                  onChange={(e) =>
                    updatePrize(index, { name: e.target.value })
                  }
                  placeholder="奖品名称"
                  className={cn(
                    creationStyles.titleInput,
                    "min-h-[44px] text-2xl",
                  )}
                />

                <div className="space-y-1.5">
                  <p className="text-xs text-text-muted">库存数量</p>
                  <CreationNumberStepper
                    value={prize.quantity}
                    min={1}
                    onChange={(quantity) => updatePrize(index, { quantity })}
                  />
                </div>

                <ProbabilitySliderField
                  value={prize.probability_percent}
                  onChange={(probability_percent) =>
                    updatePrize(index, { probability_percent })
                  }
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        disabled={overLimit}
        onClick={addPrize}
        className="inline-flex items-center gap-1.5 text-base text-brand-blue hover:underline disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Plus className="size-4" />
        添加奖品
      </button>

      <p className="text-sm text-text-muted">
        「谢谢参与」由系统自动占用剩余概率，无需单独配置奖品。
      </p>
    </div>
  );
}

export function isProbabilityConfigValid(prizes: ProbabilityPrizeDraft[]): boolean {
  if (prizes.length === 0) return false;
  if (prizes.some((p) => !p.name.trim())) return false;
  const sum = sumProbabilityPercent(prizes);
  return sum > 0 && sum <= 100 + 1e-6;
}
