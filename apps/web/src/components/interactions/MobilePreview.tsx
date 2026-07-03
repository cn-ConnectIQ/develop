"use client";

import { CheckCircle, Circle, Star } from "lucide-react";
import { MobileDevicePreview } from "@/components/admin/mobile-device-preview";
import type { InteractionPollItem } from "@/lib/interaction-manager";
import type { PollResultVisual } from "@/lib/bigscreen-display";
import {
  parseRatingConfigFromOptions,
  ratingScoreRange,
} from "@/lib/rating-poll-config";
import { cn } from "@/lib/utils";

type MobilePreviewProps = {
  poll: InteractionPollItem | null;
  resultVisual?: PollResultVisual;
  compact?: boolean;
};

export function MobilePreview({
  poll,
  resultVisual = "race_bar",
  compact,
}: MobilePreviewProps) {
  return (
    <MobileDevicePreview label="" width={compact ? 260 : 280}>
      {!poll ? (
        <p className="py-12 text-center text-sm text-text-muted">预览区域</p>
      ) : (
        <PreviewContent poll={poll} resultVisual={resultVisual} />
      )}
    </MobileDevicePreview>
  );
}

function PreviewContent({
  poll,
  resultVisual,
}: {
  poll: InteractionPollItem;
  resultVisual: PollResultVisual;
}) {
  const isChoice =
    poll.type === "SINGLE_CHOICE" || poll.type === "MULTI_CHOICE";

  return (
    <div className="space-y-5">
      <h2 className="text-xl font-semibold leading-snug">{poll.title || "问题标题"}</h2>

      {isChoice && (
        <div className="space-y-2.5">
          {poll.options.map((opt) => (
            <div
              key={opt.id}
              className="flex items-center gap-2.5 rounded-xl border border-border-light px-4 py-3.5 text-base"
            >
              {poll.type === "MULTI_CHOICE" ? (
                <CheckCircle className="size-5 shrink-0 text-text-muted" />
              ) : (
                <Circle className="size-5 shrink-0 text-text-muted" />
              )}
              <span>{opt.text || "选项"}</span>
            </div>
          ))}
        </div>
      )}

      {poll.type === "RATING" && <RatingPreview poll={poll} />}
      {poll.type === "WORD_CLOUD" && (
        <p className="text-sm text-text-muted">输入词语参与词云</p>
      )}
      {poll.type === "QNA" && (
        <div className="rounded-xl border border-border-light px-4 py-3 text-sm text-text-muted">
          在此输入您的问题…
        </div>
      )}

      {isChoice && poll.options.length > 0 && (
        <ResultVisualHint visual={resultVisual} options={poll.options} />
      )}
    </div>
  );
}

function ResultVisualHint({
  visual,
  options,
}: {
  visual: PollResultVisual;
  options: Array<{ id: string; text: string }>;
}) {
  const sample = options.slice(0, 3).map((o, i) => ({
    text: o.text || `选项 ${i + 1}`,
    pct: [42, 28, 18][i] ?? 12,
  }));

  if (visual === "word_cloud") {
    return (
      <div className="mt-4 border-t border-border-light/80 pt-4">
        <p className="mb-2 text-[10px] uppercase tracking-wider text-text-muted">
          结果呈现 · 词云
        </p>
        <div className="flex flex-wrap gap-2">
          {sample.map((s) => (
            <span
              key={s.text}
              className="rounded-full bg-brand-purple-light px-2 py-0.5 text-xs text-brand-purple"
            >
              {s.text}
            </span>
          ))}
        </div>
      </div>
    );
  }

  if (visual === "distribution") {
    return (
      <div className="mt-4 border-t border-border-light/80 pt-4">
        <p className="mb-2 text-[10px] uppercase tracking-wider text-text-muted">
          结果呈现 · 分布图
        </p>
        <div className="flex justify-center gap-1">
          {sample.map((s, i) => (
            <div
              key={s.text}
              className={cn(
                "rounded-full",
                i === 0 ? "size-14 bg-brand-blue/80" : i === 1 ? "size-10 bg-brand-blue/50" : "size-7 bg-brand-blue/30",
              )}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4 border-t border-border-light/80 pt-4">
      <p className="mb-2 text-[10px] uppercase tracking-wider text-text-muted">
        结果呈现 · 竞速条形图
      </p>
      <div className="space-y-2">
        {sample.map((s) => (
          <div key={s.text}>
            <div className="mb-0.5 flex justify-between text-xs">
              <span className="truncate">{s.text}</span>
              <span className="text-text-muted">{s.pct}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full rounded-full bg-brand-blue transition-all"
                style={{ width: `${s.pct}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RatingPreview({ poll }: { poll: InteractionPollItem }) {
  const config = parseRatingConfigFromOptions(poll.options);
  const scores = ratingScoreRange(config);
  return (
    <div className="flex justify-center gap-2 py-2">
      {scores.map((n) => (
        <Star
          key={n}
          className="size-8 text-brand-gold/80"
          fill="currentColor"
        />
      ))}
    </div>
  );
}
