"use client";

import { Plus, Trash2 } from "lucide-react";
import { CreationNumberStepper } from "@/components/admin/creation-number-stepper";
import { PrizeImageDropzone } from "@/components/admin/prize-image-dropzone";
import { creationStyles } from "@/components/admin/content-creation-layout";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { BoothLotteryPrizeDraft } from "@/lib/lottery/booth-lottery-schemas";
import { tierLabel, tierMedal } from "@/lib/lottery/organizer-lottery-config";
import { cn } from "@/lib/utils";

export type TierPrizeDraft = BoothLotteryPrizeDraft & {
  tier: number;
};

export type TierPrizeListEditorProps = {
  prizes: TierPrizeDraft[];
  onChange: (prizes: TierPrizeDraft[]) => void;
};

const PRIZE_TYPE_OPTIONS = [
  { value: "PHYSICAL" as const, label: "实物" },
  { value: "DIGITAL" as const, label: "虚拟" },
  { value: "EXPERIENCE" as const, label: "体验" },
];

function sortByTier(prizes: TierPrizeDraft[]) {
  return [...prizes].sort((a, b) => a.tier - b.tier);
}

function TierPrizeRow({
  prize,
  onChange,
  onRemove,
  canRemove,
}: {
  prize: TierPrizeDraft;
  onChange: (prize: TierPrizeDraft) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  return (
    <div className="space-y-5 border-t border-border-light py-8 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{tierMedal(prize.tier)}</span>
          <span className="text-base font-semibold">{tierLabel(prize.tier)}</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-muted">等级</span>
            <CreationNumberStepper
              value={prize.tier}
              min={1}
              max={99}
              onChange={(tier) => onChange({ ...prize, tier })}
            />
          </div>
          {canRemove && (
            <button
              type="button"
              onClick={onRemove}
              className="text-text-tertiary hover:text-brand-red"
              aria-label="删除等级"
            >
              <Trash2 className="size-4" />
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(140px,200px)_1fr]">
        <PrizeImageDropzone
          imageUrl={prize.image_url}
          alt={prize.name}
          onUpload={(url) => onChange({ ...prize, image_url: url })}
        />

        <div className="space-y-5">
          <input
            type="text"
            value={prize.name}
            onChange={(e) => onChange({ ...prize, name: e.target.value })}
            placeholder="奖品名称，例如：iPhone 15 Pro"
            className={cn(
              creationStyles.titleInput,
              "min-h-[44px] text-2xl",
            )}
          />

          <div className="flex flex-wrap items-center gap-6">
            <div className="space-y-1.5">
              <p className="text-xs text-text-muted">数量</p>
              <CreationNumberStepper
                value={prize.quantity}
                min={1}
                onChange={(quantity) => onChange({ ...prize, quantity })}
              />
            </div>
            <div className="space-y-1.5">
              <p className="text-xs text-text-muted">类型</p>
              <Select
                value={prize.prize_type}
                onValueChange={(v) =>
                  onChange({
                    ...prize,
                    prize_type: v as TierPrizeDraft["prize_type"],
                  })
                }
              >
                <SelectTrigger className="h-11 min-w-[120px] text-base">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIZE_TYPE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function TierPrizeListEditor({
  prizes,
  onChange,
}: TierPrizeListEditorProps) {
  const sorted = sortByTier(prizes);

  function updateTierPrize(tier: number, updated: TierPrizeDraft) {
    onChange(prizes.map((p) => (p.tier === tier ? updated : p)));
  }

  function removeTier(tier: number) {
    onChange(prizes.filter((p) => p.tier !== tier));
  }

  function addTier() {
    const maxTier = prizes.reduce((max, p) => Math.max(max, p.tier), 0);
    const nextTier = maxTier + 1;
    onChange([
      ...prizes,
      {
        tier: nextTier,
        name: tierLabel(nextTier),
        quantity: 1,
        prize_type: "PHYSICAL",
      },
    ]);
  }

  return (
    <div>
      {sorted.map((prize, index) => (
        <TierPrizeRow
          key={`tier-${prize.tier}-${index}`}
          prize={prize}
          onChange={(updated) => updateTierPrize(prize.tier, updated)}
          onRemove={() => removeTier(prize.tier)}
          canRemove={prizes.length > 1}
        />
      ))}

      <button
        type="button"
        onClick={addTier}
        className="mt-2 inline-flex items-center gap-1.5 text-base text-brand-blue hover:underline"
      >
        <Plus className="size-4" />
        添加等级
      </button>
    </div>
  );
}
