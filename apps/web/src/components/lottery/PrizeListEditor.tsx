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
    <div className="rounded-xl border border-border-light bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-semibold">
          {prizeRankLabel(index + 1)}
        </span>
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

      <div className="grid gap-3 md:grid-cols-[96px_1fr]">
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
              placeholder="例如：精美礼品一份"
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
                  prize_type: v as BoothLotteryPrizeDraft["prize_type"],
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
    <div className="space-y-3">
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

      <Button
        type="button"
        variant="outline"
        className="w-full border-dashed"
        onClick={addPrize}
      >
        <Plus className="mr-2 size-4" />
        添加奖品
      </Button>
    </div>
  );
}
