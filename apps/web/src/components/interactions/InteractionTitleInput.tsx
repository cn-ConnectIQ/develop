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
  const isFocusedRef = useRef(false);
  const resourceId = pollId ?? lotteryId ?? "";
  const prevResourceId = useRef(resourceId);

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
      lastSaved.current = trimmed;
      onSaved?.(trimmed);
    },
  });

  useEffect(() => {
    if (prevResourceId.current !== resourceId) {
      prevResourceId.current = resourceId;
      isFocusedRef.current = false;
      if (ref.current) {
        ref.current.textContent = value;
        lastSaved.current = value;
      }
      return;
    }

    if (
      !isFocusedRef.current &&
      ref.current &&
      ref.current.textContent !== value
    ) {
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
        onFocus={() => {
          isFocusedRef.current = true;
        }}
        onBlur={() => {
          isFocusedRef.current = false;
          const title = ref.current?.textContent ?? "";
          lastSaved.current = title;
        }}
        onInput={(e) => {
          const title = e.currentTarget.textContent ?? "";
          if (title !== lastSaved.current) {
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
