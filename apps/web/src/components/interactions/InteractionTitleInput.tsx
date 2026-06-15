"use client";

import { useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
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
  const ref = useRef<HTMLDivElement>(null);
  const lastSaved = useRef(value);
  const resourceId = pollId ?? lotteryId ?? "";

  const { scheduleSave, saveState } = useInteractionAutoSave<{ title: string }>({
    debounceMs: 600,
    onSave: async (payload) => {
      if (pollId) {
        await patchPoll(eventId, pollId, payload);
      } else if (lotteryId) {
        await patchLottery(eventId, lotteryId, payload);
      }
      lastSaved.current = payload.title;
      onSaved?.(payload.title);
    },
  });

  useEffect(() => {
    if (ref.current && ref.current.textContent !== value) {
      ref.current.textContent = value;
      lastSaved.current = value;
    }
  }, [value, resourceId]);

  return (
    <div className={cn("flex items-start gap-3", className)}>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        data-placeholder={placeholder}
        className="interaction-title-input min-h-[40px] flex-1 text-[22px] font-semibold leading-tight outline-none empty:before:pointer-events-none empty:before:text-text-tertiary empty:before:content-[attr(data-placeholder)]"
        onInput={(e) => {
          const title = e.currentTarget.textContent?.trim() ?? "";
          if (title && title !== lastSaved.current) {
            scheduleSave({ title });
          }
        }}
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
