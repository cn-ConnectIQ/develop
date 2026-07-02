"use client";

import { ImeSafeInput } from "@/components/ui/ime-safe-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type RatingEditorProps = {
  minScore?: number;
  maxScore?: number;
  lowLabel?: string;
  highLabel?: string;
  onChange?: (values: {
    minScore: number;
    maxScore: number;
    lowLabel: string;
    highLabel: string;
  }) => void;
};

export function RatingEditor({
  minScore = 1,
  maxScore = 5,
  lowLabel = "",
  highLabel = "",
  onChange,
}: RatingEditorProps) {
  function emit(
    patch: Partial<{
      minScore: number;
      maxScore: number;
      lowLabel: string;
      highLabel: string;
    }>,
  ) {
    const next = {
      minScore: patch.minScore ?? minScore,
      maxScore: patch.maxScore ?? maxScore,
      lowLabel: patch.lowLabel ?? lowLabel,
      highLabel: patch.highLabel ?? highLabel,
    };
    if (next.minScore > next.maxScore) {
      if (patch.minScore != null) {
        next.maxScore = next.minScore;
      } else {
        next.minScore = next.maxScore;
      }
    }
    onChange?.(next);
  }

  return (
    <div className="mt-4">
      <div className="flex items-center gap-3">
        <Select
          value={String(minScore)}
          onValueChange={(v) => emit({ minScore: Number(v) })}
        >
          <SelectTrigger className="h-9 w-20">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[1, 2, 3, 4, 5].map((n) => (
              <SelectItem key={n} value={String(n)}>
                {n}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-text-muted">到</span>
        <Select
          value={String(maxScore)}
          onValueChange={(v) => emit({ maxScore: Number(v) })}
        >
          <SelectTrigger className="h-9 w-20">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
              <SelectItem key={n} value={String(n)}>
                {n}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="mt-3 flex gap-3">
        <ImeSafeInput
          value={lowLabel}
          debounceMs={600}
          onValueCommit={(text) => emit({ lowLabel: text })}
          placeholder="非常不满意"
          className="h-9 w-36 rounded-lg border border-border-light bg-white px-3 text-sm shadow-none focus-visible:ring-1"
        />
        <ImeSafeInput
          value={highLabel}
          debounceMs={600}
          onValueCommit={(text) => emit({ highLabel: text })}
          placeholder="非常满意"
          className="h-9 w-36 rounded-lg border border-border-light bg-white px-3 text-sm shadow-none focus-visible:ring-1"
        />
      </div>
    </div>
  );
}
