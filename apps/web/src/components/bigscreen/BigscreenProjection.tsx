"use client";

import { PollVotingBigScreen } from "@/components/bigscreen/PollVotingBigScreen";
import { QnaProjectionView } from "@/components/bigscreen/QnaProjectionView";
import { WordCloudView } from "@/components/bigscreen/WordCloudView";
import { BigscreenJoinQr } from "@/components/bigscreen/BigscreenJoinQr";
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
  scanUrl?: string | null;
  qrUrl?: string | null;
  wxacodeUrl?: string | null;
};

export function BigscreenProjection({
  poll,
  showResults,
  countdown,
  results,
  wordCloud,
  qnaQuestions,
  scanUrl = null,
  qrUrl = null,
  wxacodeUrl = null,
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

  if (poll.type === "QNA") {
    return (
      <div className="relative flex flex-1 flex-col bg-[#1a1d2e]">
        <div className="absolute right-[5%] top-8 z-10">
          <BigscreenJoinQr
            wxacodeUrl={wxacodeUrl}
            scanUrl={scanUrl}
            qrUrl={qrUrl}
            size={112}
          />
        </div>
        <div className="p-8 pr-[180px]">
          <span className="rounded-full bg-brand-blue px-3 py-1 text-xs text-white">
            问答进行中 · {typeLabel}
          </span>
          <h1 className="mt-8 px-12 text-center text-[28px] leading-snug font-bold text-white">
            {poll.title}
          </h1>
        </div>
        <QnaProjectionView question={featuredQna} />
      </div>
    );
  }

  if (poll.type === "WORD_CLOUD" && showResults) {
    return (
      <div className="relative flex flex-1 flex-col bg-[#1a1d2e]">
        <div className="absolute right-[5%] top-8 z-10">
          <BigscreenJoinQr
            wxacodeUrl={wxacodeUrl}
            scanUrl={scanUrl}
            qrUrl={qrUrl}
            size={112}
          />
        </div>
        <div className="px-[5%] pt-[4%] pr-[200px] text-center">
          <p className="text-sm text-white/45">现场投票 · 词云</p>
          <h1 className="mt-4 text-[28px] font-bold text-white">{poll.title}</h1>
        </div>
        <WordCloudView words={wordCloud} />
      </div>
    );
  }

  if (isChoicePoll) {
    return (
      <div className="relative flex h-full min-h-0 flex-1 flex-col">
        <PollVotingBigScreen
          title={poll.title}
          total={results?.total ?? poll.responseCount}
          options={showResults ? (results?.options ?? []) : []}
          showResults={showResults}
          countdown={countdown}
          closesAt={poll.closesAt}
          createdAt={poll.createdAt}
          scanUrl={scanUrl}
          qrUrl={qrUrl}
          wxacodeUrl={wxacodeUrl}
        />
      </div>
    );
  }

  if (poll.type === "ANNOUNCEMENT") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center bg-[#1a1d2e] px-12 pb-24">
        <p className="text-center text-2xl text-white/80">{poll.title}</p>
      </div>
    );
  }

  return (
    <PollVotingBigScreen
      title={poll.title}
      total={results?.total ?? poll.responseCount}
      options={results?.options ?? []}
      showResults={showResults}
      countdown={countdown}
      closesAt={poll.closesAt}
      createdAt={poll.createdAt}
      scanUrl={scanUrl}
      qrUrl={qrUrl}
      wxacodeUrl={wxacodeUrl}
    />
  );
}
