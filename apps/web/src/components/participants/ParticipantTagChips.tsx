"use client";

import { cn } from "@/lib/utils";
import {
  getTagLabel,
  getTagStyle,
} from "@/lib/participant-tags";

export function ParticipantTagChips({
  tags,
  max = 4,
  className,
}: {
  tags: string[];
  max?: number;
  className?: string;
}) {
  if (!tags.length) {
    return <span className="text-xs text-text-tertiary">—</span>;
  }

  const visible = tags.slice(0, max);
  const rest = tags.length - visible.length;

  return (
    <div className={cn("flex flex-wrap gap-1", className)}>
      {visible.map((tag) => {
        const style = getTagStyle(tag);
        return (
          <span
            key={tag}
            className={cn(
              "inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium",
              style.className,
            )}
          >
            {getTagLabel(tag)}
          </span>
        );
      })}
      {rest > 0 && (
        <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-text-muted">
          +{rest}
        </span>
      )}
    </div>
  );
}
