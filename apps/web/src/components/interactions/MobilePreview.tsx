"use client";

import { CheckCircle, Circle, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import type { InteractionPollItem } from "@/lib/interaction-manager";
import {
  parseRatingConfigFromOptions,
  ratingScoreRange,
} from "@/lib/rating-poll-config";

type MobilePreviewProps = {
  poll: InteractionPollItem | null;
};

export function MobilePreview({ poll }: MobilePreviewProps) {
  return (
    <div className="hidden w-72 shrink-0 border-l border-border-light px-4 py-5 lg:block">
      <p className="mb-3 text-[10px] uppercase tracking-widest text-text-muted">
        参会者看到的效果
      </p>
      <div className="mx-auto w-[200px]">
        <div className="aspect-[9/19.5] overflow-hidden rounded-3xl border-4 border-gray-800 bg-white">
          <div className="origin-top scale-[0.53] p-4" style={{ width: 377 }}>
            {!poll ? (
              <p className="text-center text-sm text-text-muted">预览区域</p>
            ) : (
              <PreviewContent poll={poll} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function PreviewContent({ poll }: { poll: InteractionPollItem }) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold leading-snug">{poll.title}</h2>
      {(poll.type === "SINGLE_CHOICE" || poll.type === "MULTI_CHOICE") && (
        <div className="space-y-2">
          {poll.options.map((opt) => (
            <div
              key={opt.id}
              className="flex items-center gap-2 rounded-lg border border-border-light px-3 py-2.5 text-sm"
            >
              {poll.type === "MULTI_CHOICE" ? (
                <CheckCircle className="size-4 text-text-muted" />
              ) : (
                <Circle className="size-4 text-text-muted" />
              )}
              {opt.text}
            </div>
          ))}
        </div>
      )}
      {poll.type === "RATING" && (
        <RatingPreview poll={poll} />
      )}
      {poll.type === "WORD_CLOUD" && (
        <p className="text-sm text-text-muted">输入关键词参与词云…</p>
      )}
      {poll.type === "QNA" && (
        <div className="rounded-lg border border-border-light px-3 py-2 text-sm text-text-muted">
          在此输入您的问题…
        </div>
      )}
      {poll.type === "ANNOUNCEMENT" && (
        <p className="text-sm">{poll.options[0]?.text ?? "公告内容"}</p>
      )}
    </div>
  );
}

function RatingPreview({ poll }: { poll: InteractionPollItem }) {
  const config = parseRatingConfigFromOptions(poll.options);
  const scores = ratingScoreRange(config);

  return (
    <div className="py-2">
      <div className="flex justify-center gap-1 py-3">
        {scores.map((n) => (
          <Star
            key={n}
            className={cn(
              "size-6",
              n <= Math.ceil(scores.length / 2)
                ? "fill-brand-gold text-brand-gold"
                : "text-gray-300",
            )}
          />
        ))}
      </div>
      <div className="flex justify-between text-xs text-text-muted">
        <span>{config.lowLabel || "非常不满意"}</span>
        <span>{config.highLabel || "非常满意"}</span>
      </div>
    </div>
  );
}
