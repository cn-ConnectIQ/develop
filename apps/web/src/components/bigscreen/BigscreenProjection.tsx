"use client";

import { CountdownRing } from "@/components/bigscreen/CountdownRing";
import { PollBarsView } from "@/components/bigscreen/PollBarsView";
import { QnaProjectionView } from "@/components/bigscreen/QnaProjectionView";
import { WordCloudView } from "@/components/bigscreen/WordCloudView";
import { pollTypeLabel } from "@/lib/bigscreen-display";
import type { BigscreenPoll, PollOptionResult, WordCloudItem } from "@/lib/bigscreen-types";
import type { QnaQuestion } from "@/lib/bigscreen-display";

type BigscreenProjectionProps = {
  poll: BigscreenPoll;
  showResults: boolean;
  countdown: string;
  results: { total: number; options: PollOptionResult[] } | null;
  wordCloud: WordCloudItem[];
  qnaQuestions: QnaQuestion[];
};

export function BigscreenProjection({
  poll,
  showResults,
  countdown,
  results,
  wordCloud,
  qnaQuestions,
}: BigscreenProjectionProps) {
  const typeLabel = pollTypeLabel(poll.type);
  const featuredQna =
    qnaQuestions.find((q) => q.featured && !q.hidden) ??
    qnaQuestions.find((q) => !q.hidden) ??
    null;

  const isChoicePoll =
    poll.type === "SINGLE_CHOICE" ||
    poll.type === "MULTI_CHOICE" ||
    poll.type === "RATING";

  return (
    <>
      <div className="p-8">
        <span className="rounded-full bg-brand-green px-3 py-1 text-xs text-white">
          正在进行 · {typeLabel}
        </span>
        <h1 className="mt-8 px-12 text-center text-[28px] leading-snug font-bold text-white">
          {poll.title}
        </h1>
      </div>

      {poll.type === "WORD_CLOUD" && showResults && (
        <WordCloudView words={wordCloud} />
      )}

      {poll.type === "QNA" && (
        <QnaProjectionView question={featuredQna} />
      )}

      {isChoicePoll && showResults && results && (
        <PollBarsView options={results.options} />
      )}

      {isChoicePoll && !showResults && (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-2xl text-white/50">投票进行中，结果暂不显示</p>
        </div>
      )}

      {poll.type === "ANNOUNCEMENT" && (
        <div className="flex flex-1 items-center justify-center px-12 pb-24">
          <p className="text-center text-2xl text-white/80">{poll.title}</p>
        </div>
      )}

      <footer className="absolute right-0 bottom-0 left-0 flex items-center justify-between px-8 py-4">
        <span className="text-sm text-white/60">
          {results?.total ?? poll.responseCount} 人已投票 · 实时更新
        </span>
        <div className="flex items-center gap-3">
          <span className="font-mono text-2xl font-bold text-brand-amber">
            {countdown}
          </span>
          <CountdownRing
            closesAt={poll.closesAt}
            startedAt={poll.createdAt}
          />
        </div>
        <span className="text-sm text-white/30">ConnectIQ</span>
      </footer>
    </>
  );
}
