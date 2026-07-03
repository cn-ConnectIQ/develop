"use client";

import { Plus, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleUpload(file: File) {
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: form });
      if (!res.ok) throw new Error("上传失败");
      const json = (await res.json()) as { data?: { url?: string }; url?: string };
      const url = json.data?.url ?? json.url;
      if (!url) throw new Error("上传失败");
      onChange({ ...prize, image_url: url });
      toast.success("图片已上传");
    } catch {
      toast.error("图片上传失败");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="border-t border-border-light first:border-t-0">
      <div className="flex items-center justify-between bg-gray-50/80 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="text-lg">{tierMedal(prize.tier)}</span>
          <span className="text-sm font-semibold">{tierLabel(prize.tier)}</span>
          <span className="text-xs text-text-muted">tier={prize.tier}</span>
        </div>
        <div className="flex items-center gap-2">
          <Label className="sr-only">等级序号</Label>
          <Input
            type="number"
            min={1}
            max={99}
            className="h-7 w-14 text-center text-xs"
            value={prize.tier}
            onChange={(e) =>
              onChange({
                ...prize,
                tier: Math.max(1, Number(e.target.value) || 1),
              })
            }
          />
          {canRemove && (
            <button
              type="button"
              onClick={onRemove}
              className="text-text-tertiary hover:text-brand-red"
            >
              <Trash2 className="size-4" />
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-3 p-4 md:grid-cols-[96px_1fr]">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className={cn(
            "flex aspect-square items-center justify-center overflow-hidden rounded-lg border border-dashed border-border-light bg-gray-50 transition-colors hover:border-brand-blue/50",
            prize.image_url && "border-solid",
          )}
        >
          {prize.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={prize.image_url}
              alt={prize.name}
              className="size-full object-cover"
            />
          ) : uploading ? (
            <span className="text-xs text-text-muted">上传中…</span>
          ) : (
            <Upload className="size-5 text-text-muted" />
          )}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleUpload(file);
          }}
        />

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label className="text-xs">奖品名称</Label>
            <Input
              className="mt-1 h-9"
              value={prize.name}
              onChange={(e) => onChange({ ...prize, name: e.target.value })}
              placeholder="例如：iPhone 15 Pro"
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
                onChange({
                  ...prize,
                  quantity: Math.max(1, Number(e.target.value) || 1),
                })
              }
            />
          </div>
          <div>
            <Label className="text-xs">类型</Label>
            <Select
              value={prize.prize_type}
              onValueChange={(v) =>
                onChange({
                  ...prize,
                  prize_type: v as TierPrizeDraft["prize_type"],
                })
              }
            >
              <SelectTrigger className="mt-1 h-9">
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
  );
}

export function TierPrizeListEditor({
  prizes,
  onChange,
}: TierPrizeListEditorProps) {
  const sorted = sortByTier(prizes);

  function updateTierPrize(tier: number, updated: TierPrizeDraft) {
    onChange(
      prizes.map((p) => (p.tier === tier ? updated : p)),
    );
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
    <div className="overflow-hidden rounded-xl border border-border-light">
      {sorted.map((prize, index) => (
        <TierPrizeRow
          key={`tier-${prize.tier}-${index}`}
          prize={prize}
          onChange={(updated) => updateTierPrize(prize.tier, updated)}
          onRemove={() => removeTier(prize.tier)}
          canRemove={prizes.length > 1}
        />
      ))}

      <div className="border-t border-border-light p-3">
        <Button
          type="button"
          variant="outline"
          className="w-full border-dashed"
          onClick={addTier}
        >
          <Plus className="mr-2 size-4" />
          添加等级
        </Button>
      </div>
    </div>
  );
}
