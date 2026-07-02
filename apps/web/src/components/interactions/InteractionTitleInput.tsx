"use client";

import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ImeSafeInput } from "@/components/ui/ime-safe-input";
import {
  useInteractionAutoSave,
  patchPoll,
  patchLottery,
} from "@/hooks/useInteractionAutoSave";

type InteractionTitleInputProps = {
  eventId: string;
  pollId?: string;
  lotteryId?: string;
  value: string;
  placeholder?: string;
  onSaved?: (title: string) => void;
  className?: string;
};

export function InteractionTitleInput({
  eventId,
  pollId,
  lotteryId,
  value,
  placeholder = "输入互动标题…",
  onSaved,
  className,
}: InteractionTitleInputProps) {
  const resourceId = pollId ?? lotteryId ?? "";

  const { scheduleSave, saveState } = useInteractionAutoSave<{ title: string }>({
    debounceMs: 600,
    onSave: async (payload) => {
      const trimmed = payload.title.trim();
      if (!trimmed) return;

      if (pollId) {
        await patchPoll(eventId, pollId, { title: trimmed });
      } else if (lotteryId) {
        await patchLottery(eventId, lotteryId, { title: trimmed });
      }
      onSaved?.(trimmed);
    },
  });

  return (
    <div className={cn("flex items-start gap-3", className)}>
      <ImeSafeInput
        key={resourceId}
        value={value}
        debounceMs={600}
        placeholder={placeholder}
        onValueCommit={(title) => scheduleSave({ title })}
        className="h-auto min-h-[40px] flex-1 border-0 bg-transparent px-0 text-[22px] font-semibold leading-tight shadow-none outline-none placeholder:text-text-tertiary focus-visible:ring-0"
      />
      <div className="shrink-0 pt-1">
        {saveState === "saving" && (
          <Loader2 className="size-4 animate-spin text-text-tertiary" />
        )}
        {saveState === "saved" && (
          <span className="text-xs text-text-muted">✓ 已保存</span>
        )}
      </div>
    </div>
  );
}
