"use client";

import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  CheckCircle,
  CheckSquare,
  Cloud,
  Gift,
  MessageSquare,
  Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { InteractionQRDisplay } from "@/components/interactions/InteractionQRDisplay";
import type { BoothInteractionItem } from "@/lib/exhibitor/booth-interaction-types";
import { POLL_TYPE_LABELS } from "@/lib/interactions";
import { cn } from "@/lib/utils";

const typeIcons: Record<string, typeof CheckCircle> = {
  SINGLE_CHOICE: CheckCircle,
  MULTI_CHOICE: CheckSquare,
  WORD_CLOUD: Cloud,
  RATING: Star,
  QNA: MessageSquare,
  RANDOM: Gift,
};

const POLL_STATUS_LABELS: Record<string, string> = {
  DRAFT: "草稿",
  LIVE: "进行中",
  PAUSED: "已暂停",
  CLOSED: "已结束",
};

const LOTTERY_STATUS_LABELS: Record<string, string> = {
  DRAFT: "草稿",
  READY: "待开放",
  OPEN: "进行中",
  DRAWING: "抽奖中",
  FINISHED: "已结束",
};

function statusBadgeClass(status: string) {
  if (status === "LIVE" || status === "OPEN") {
    return "bg-brand-amber-light text-brand-amber";
  }
  if (status === "CLOSED" || status === "FINISHED") {
    return "bg-border-light text-text-muted";
  }
  return "bg-brand-blue-light text-brand-blue";
}

type BoothInteractionControlSheetProps = {
  boothId: string;
  interaction: BoothInteractionItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
};

export function BoothInteractionControlSheet({
  boothId,
  interaction,
  open,
  onOpenChange,
  onUpdated,
}: BoothInteractionControlSheetProps) {
  const patchInteraction = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      if (!interaction) return;
      const res = await fetch(
        `/api/booths/${boothId}/interactions/${interaction.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      if (!res.ok) throw new Error("操作失败");
    },
    onSuccess: () => {
      toast.success("状态已更新");
      onUpdated();
    },
    onError: () => toast.error("操作失败"),
  });

  if (!interaction) return null;

  const Icon = typeIcons[interaction.subType] ?? CheckCircle;
  const statusLabel =
    interaction.kind === "poll"
      ? (POLL_STATUS_LABELS[interaction.status] ?? interaction.status)
      : (LOTTERY_STATUS_LABELS[interaction.status] ?? interaction.status);
  const typeLabel =
    interaction.kind === "poll"
      ? (POLL_TYPE_LABELS[interaction.subType] ?? "投票")
      : "现场抽奖";

  const isPending = patchInteraction.isPending;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-[560px]">
        <SheetHeader>
          <SheetTitle>互动控制</SheetTitle>
        </SheetHeader>

        <div className="mt-4 flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-amber-light">
            <Icon className="size-5 text-brand-amber" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{interaction.title}</p>
            <p className="text-sm text-text-muted">
              {typeLabel} · {interaction.participantCount} 人参与
            </p>
            <span
              className={cn(
                "mt-2 inline-block rounded-full px-2.5 py-0.5 text-xs font-medium",
                statusBadgeClass(interaction.status),
              )}
            >
              {statusLabel}
            </span>
          </div>
        </div>

        <div className="mt-6 space-y-2">
          <p className="text-sm font-medium">状态控制</p>
          {interaction.kind === "poll" && (
            <div className="flex flex-wrap gap-2">
              {interaction.status !== "LIVE" && interaction.status !== "CLOSED" && (
                <Button
                  size="sm"
                  className="bg-brand-amber hover:bg-brand-amber/90"
                  disabled={isPending}
                  onClick={() => patchInteraction.mutate({ publish: true })}
                >
                  发布
                </Button>
              )}
              {interaction.status === "LIVE" && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isPending}
                  onClick={() => patchInteraction.mutate({ pause: true })}
                >
                  暂停
                </Button>
              )}
              {interaction.status !== "CLOSED" && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isPending}
                  onClick={() => patchInteraction.mutate({ close: true })}
                >
                  结束
                </Button>
              )}
            </div>
          )}
          {interaction.kind === "lottery" && (
            <div className="flex flex-wrap gap-2">
              {(interaction.status === "DRAFT" || interaction.status === "READY") && (
                <Button
                  size="sm"
                  className="bg-brand-amber hover:bg-brand-amber/90"
                  disabled={isPending}
                  onClick={() => patchInteraction.mutate({ publish: true })}
                >
                  开放参与
                </Button>
              )}
              {interaction.status === "OPEN" && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isPending}
                  onClick={() => patchInteraction.mutate({ close: true })}
                >
                  结束抽奖
                </Button>
              )}
            </div>
          )}
        </div>

        {interaction.qrUrl && (
          <InteractionQRDisplay
            sessionCode={interaction.sessionCode}
            qrUrl={interaction.qrUrl}
            interactionTitle={interaction.title}
            className="mt-6 border-0 p-0 shadow-none"
          />
        )}
      </SheetContent>
    </Sheet>
  );
}
