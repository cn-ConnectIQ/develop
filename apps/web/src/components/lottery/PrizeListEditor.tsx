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
import { prizeRankLabel } from "@/lib/lottery-types";
import { cn } from "@/lib/utils";

export type PrizeListEditorProps = {
  prizes: BoothLotteryPrizeDraft[];
  onChange: (prizes: BoothLotteryPrizeDraft[]) => void;
};

const PRIZE_TYPE_OPTIONS = [
  { value: "PHYSICAL" as const, label: "实物" },
  { value: "DIGITAL" as const, label: "虚拟" },
  { value: "EXPERIENCE" as const, label: "体验" },
];

function PrizeRow({
  prize,
  index,
  onChange,
  onRemove,
  canRemove,
}: {
  prize: BoothLotteryPrizeDraft;
  index: number;
  onChange: (prize: BoothLotteryPrizeDraft) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  return (
    <div className="space-y-5 border-t border-border-light py-8 first:border-t-0 first:pt-0">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-text-muted">
          {prizeRankLabel(index + 1)}
        </span>
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="text-text-tertiary hover:text-brand-red"
            aria-label="删除奖品"
          >
            <Trash2 className="size-4" />
          </button>
        )}
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
            placeholder="奖品名称，例如：精美礼品一份"
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
                    prize_type: v as BoothLotteryPrizeDraft["prize_type"],
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

export function PrizeListEditor({ prizes, onChange }: PrizeListEditorProps) {
  function updatePrize(index: number, prize: BoothLotteryPrizeDraft) {
    onChange(prizes.map((p, i) => (i === index ? prize : p)));
  }

  function addPrize() {
    onChange([
      ...prizes,
      {
        name: prizeRankLabel(prizes.length + 1),
        quantity: 1,
        prize_type: "PHYSICAL",
      },
    ]);
  }

  return (
    <div>
      {prizes.map((prize, index) => (
        <PrizeRow
          key={index}
          prize={prize}
          index={index}
          onChange={(updated) => updatePrize(index, updated)}
          onRemove={() => onChange(prizes.filter((_, i) => i !== index))}
          canRemove={prizes.length > 1}
        />
      ))}

      <button
        type="button"
        onClick={addPrize}
        className="mt-2 inline-flex items-center gap-1.5 text-base text-brand-blue hover:underline"
      >
        <Plus className="size-4" />
        添加奖品
      </button>
    </div>
  );
}
