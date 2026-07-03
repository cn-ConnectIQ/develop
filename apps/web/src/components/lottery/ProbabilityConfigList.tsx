"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
    <div className="space-y-4">
      <div
        className={cn(
          "rounded-lg px-4 py-3 text-sm",
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

      <div className="space-y-3">
        {prizes.map((prize, index) => (
          <div
            key={index}
            className="rounded-xl border border-border-light bg-white p-4"
          >
            <div className="mb-3 flex items-start justify-between gap-2">
              <div className="grid flex-1 gap-3 sm:grid-cols-2">
                <div>
                  <Label className="text-xs">奖品名称</Label>
                  <Input
                    className="mt-1 h-9"
                    value={prize.name}
                    onChange={(e) =>
                      updatePrize(index, { name: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label className="text-xs">数量</Label>
                  <Input
                    type="number"
                    min={1}
                    className="mt-1 h-9"
                    value={prize.quantity}
                    onChange={(e) =>
                      updatePrize(index, {
                        quantity: Math.max(1, Number(e.target.value) || 1),
                      })
                    }
                  />
                </div>
              </div>
              {prizes.length > 1 && (
                <button
                  type="button"
                  className="mt-5 text-text-tertiary hover:text-brand-red"
                  onClick={() => onChange(prizes.filter((_, i) => i !== index))}
                >
                  <Trash2 className="size-4" />
                </button>
              )}
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between">
                <Label className="text-xs">中奖概率</Label>
                <span className="text-sm font-semibold tabular-nums">
                  {prize.probability_percent.toFixed(1)}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={0.5}
                value={prize.probability_percent}
                onChange={(e) =>
                  updatePrize(index, {
                    probability_percent: Number(e.target.value),
                  })
                }
                className="h-2 w-full cursor-pointer accent-brand-green"
              />
            </div>
          </div>
        ))}
      </div>

      <Button
        type="button"
        variant="outline"
        className="w-full border-dashed"
        onClick={addPrize}
        disabled={overLimit}
      >
        <Plus className="mr-2 size-4" />
        添加奖品
      </Button>

      <p className="text-xs text-text-muted">
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
