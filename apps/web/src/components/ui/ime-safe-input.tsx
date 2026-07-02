"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

type ImeSafeInputProps = Omit<
  React.ComponentProps<"input">,
  "value" | "defaultValue" | "onChange"
> & {
  value: string;
  onValueCommit: (value: string) => void;
  debounceMs?: number;
};

/**
 * 非受控输入：打字过程中不回流父组件 state，避免中文 IME 组合时光标跳动。
 * 仅在失焦、选字完成（compositionend）或防抖后提交变更。
 */
export function ImeSafeInput({
  value,
  onValueCommit,
  debounceMs = 800,
  className,
  onFocus,
  onBlur,
  onCompositionStart,
  onCompositionEnd,
  ...props
}: ImeSafeInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const composingRef = useRef(false);
  const focusedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastCommittedRef = useRef(value);

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const commit = (next: string) => {
    clearTimer();
    if (next === lastCommittedRef.current) return;
    lastCommittedRef.current = next;
    onValueCommit(next);
  };

  const scheduleCommit = (next: string) => {
    clearTimer();
    timerRef.current = setTimeout(() => commit(next), debounceMs);
  };

  useEffect(() => {
    lastCommittedRef.current = value;
    if (focusedRef.current || composingRef.current) return;
    const el = inputRef.current;
    if (el && el.value !== value) {
      el.value = value;
    }
  }, [value]);

  useEffect(() => () => clearTimer(), []);

  return (
    <input
      ref={inputRef}
      defaultValue={value}
      className={cn(
        "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        className,
      )}
      onFocus={(e) => {
        focusedRef.current = true;
        onFocus?.(e);
      }}
      onBlur={(e) => {
        focusedRef.current = false;
        commit(e.target.value);
        onBlur?.(e);
      }}
      onCompositionStart={(e) => {
        composingRef.current = true;
        clearTimer();
        onCompositionStart?.(e);
      }}
      onCompositionEnd={(e) => {
        composingRef.current = false;
        commit(e.currentTarget.value);
        onCompositionEnd?.(e);
      }}
      onChange={(e) => {
        if (!composingRef.current) {
          scheduleCommit(e.target.value);
        }
      }}
      {...props}
    />
  );
}
