"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { buildParticipantCreatePath } from "@/lib/lottery/participant-lottery-utils";
import { withPublicPath } from "@/lib/public-path";
import { cn } from "@/lib/utils";

type LotteryCreateType = "probability" | "instant";
type InitiatorType = "organizer" | "booth";

type BoothOption = {
  id: string;
  code: string;
  name: string;
};

const TYPE_OPTIONS: Array<{
  value: LotteryCreateType;
  emoji: string;
  title: string;
  description: string;
}> = [
  {
    value: "probability",
    emoji: "🎡",
    title: "概率抽奖（转盘/九宫格）",
    description: "多奖品按概率随机",
  },
  {
    value: "instant",
    emoji: "🎁",
    title: "直接领取",
    description: "填信息必得，单一奖品",
  },
];

const INITIATOR_OPTIONS: Array<{
  value: InitiatorType;
  title: string;
  description: string;
}> = [
  {
    value: "organizer",
    title: "主办方发起",
    description: "活动现场统一抽奖，不绑定展位",
  },
  {
    value: "booth",
    title: "展位发起",
    description: "为指定参展商展位配置抽奖",
  },
];

async function fetchBooths(eventId: string) {
  const res = await fetch(withPublicPath(`/api/events/${eventId}/booths`));
  if (!res.ok) throw new Error("展位加载失败");
  const json = (await res.json()) as { data?: { booths?: BoothOption[] } };
  return json.data?.booths ?? [];
}

export type NewLotteryTypePickerProps = {
  eventId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function NewLotteryTypePicker({
  eventId,
  open,
  onOpenChange,
}: NewLotteryTypePickerProps) {
  const router = useRouter();
  const [selectedType, setSelectedType] =
    useState<LotteryCreateType>("probability");
  const [initiator, setInitiator] = useState<InitiatorType>("organizer");
  const [selectedBoothId, setSelectedBoothId] = useState("");

  const { data: booths = [] } = useQuery({
    queryKey: ["event-booths", eventId],
    queryFn: () => fetchBooths(eventId),
    enabled: open && initiator === "booth",
  });

  function resetState() {
    setSelectedType("probability");
    setInitiator("organizer");
    setSelectedBoothId("");
  }

  function handleOpenChange(next: boolean) {
    if (!next) resetState();
    onOpenChange(next);
  }

  function handleContinue() {
    if (initiator === "booth" && !selectedBoothId) return;

    const path = buildParticipantCreatePath(
      eventId,
      initiator === "organizer"
        ? { type: "organizer" }
        : { type: "booth", boothId: selectedBoothId },
      selectedType,
    );
    handleOpenChange(false);
    router.push(path);
  }

  const canContinue =
    initiator === "organizer" ||
    (initiator === "booth" && selectedBoothId.length > 0);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>选择抽奖类型</DialogTitle>
        </DialogHeader>

        <div className="grid gap-3 py-2 sm:grid-cols-2">
          {TYPE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setSelectedType(option.value)}
              className={cn(
                "rounded-lg border bg-surface p-5 text-left shadow-sm transition-shadow hover:shadow-md",
                selectedType === option.value
                  ? "border-brand-green ring-1 ring-brand-green/20"
                  : "border-border",
              )}
            >
              <span className="text-2xl">{option.emoji}</span>
              <p className="mt-3 text-sm font-semibold text-text-primary">
                {option.title}
              </p>
              <p className="mt-1 text-xs text-text-secondary">
                {option.description}
              </p>
            </button>
          ))}
        </div>

        <div className="space-y-2 pt-2">
          <p className="text-sm font-medium text-text-primary">发起方</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {INITIATOR_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  setInitiator(option.value);
                  setSelectedBoothId("");
                }}
                className={cn(
                  "rounded-lg border px-4 py-3 text-left transition-colors",
                  initiator === option.value
                    ? "border-brand-green bg-brand-green-soft"
                    : "border-border hover:bg-surface-secondary/70",
                )}
              >
                <p className="text-sm font-medium text-text-primary">
                  {option.title}
                </p>
                <p className="mt-0.5 text-xs text-text-secondary">
                  {option.description}
                </p>
              </button>
            ))}
          </div>
        </div>

        {initiator === "booth" && (
          <div className="space-y-2 pt-2">
            <p className="text-sm font-medium text-text-primary">选择展位</p>
            <Select
              value={selectedBoothId}
              onValueChange={(value) => setSelectedBoothId(value ?? "")}
            >
              <SelectTrigger>
                <SelectValue placeholder="选择要配置抽奖的展位" />
              </SelectTrigger>
              <SelectContent>
                {booths.map((booth) => (
                  <SelectItem key={booth.id} value={booth.id}>
                    {booth.code} · {booth.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            取消
          </Button>
          <Button
            disabled={!canContinue}
            className="shadow-sm"
            onClick={handleContinue}
          >
            继续配置
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
