"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PollVotingBigScreen } from "@/components/bigscreen/PollVotingBigScreen";
import { WordCloudView } from "@/components/bigscreen/WordCloudView";
import { useRealtimePollResults } from "@/hooks/useRealtimePollResults";
import type { BigscreenData } from "@/lib/bigscreen-types";

async function fetchCurrentPoll(eventId: string): Promise<BigscreenData> {
  const res = await fetch(`/api/events/${eventId}/bigscreen/current`);
  if (!res.ok) throw new Error("加载失败");
  return (await res.json()).data as BigscreenData;
}

type PollVotingBigScreenClientProps = {
  eventId: string;
};

export function PollVotingBigScreenClient({
  eventId,
}: PollVotingBigScreenClientProps) {
  const searchParams = useSearchParams();
  const pollParam = searchParams.get("poll");

  const { data: currentData, isLoading: loadingCurrent } = useQuery({
    queryKey: ["bigscreen", eventId],
    queryFn: () => fetchCurrentPoll(eventId),
    enabled: !pollParam,
    refetchInterval: 10_000,
  });

  const [resolvedPollId, setResolvedPollId] = useState<string | null>(
    pollParam,
  );

  useEffect(() => {
    if (pollParam) {
      setResolvedPollId(pollParam);
      return;
    }
    if (currentData?.livePoll?.id) {
      setResolvedPollId(currentData.livePoll.id);
    }
  }, [pollParam, currentData?.livePoll?.id]);

  const { data, loading, error } = useRealtimePollResults({
    eventId,
    pollId: resolvedPollId,
    enabled: !!resolvedPollId,
  });

  const isChoicePoll =
    data?.type === "SINGLE_CHOICE" ||
    data?.type === "MULTI_CHOICE" ||
    data?.type === "RATING";

  if (!pollParam && loadingCurrent) {
    return (
      <div className="flex h-full items-center justify-center bg-[#1a1d2e] text-white/50">
        加载投票大屏…
      </div>
    );
  }

  if (!resolvedPollId && !loadingCurrent) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 bg-[#1a1d2e] text-white/60">
        <p className="text-xl">暂无进行中的投票</p>
        <Link
          href={`/events/${eventId}/interactions`}
          className="text-[#2dd4bf] hover:underline"
        >
          前往互动管理发布 →
        </Link>
      </div>
    );
  }

  if (loading && !data) {
    return (
      <div className="flex h-full items-center justify-center bg-[#1a1d2e] text-white/50">
        加载实时结果…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex h-full items-center justify-center bg-[#1a1d2e] text-white/50">
        {error ?? "加载失败"}
      </div>
    );
  }

  if (data.type === "WORD_CLOUD") {
    return (
      <div className="relative flex h-full flex-col bg-[#1a1d2e]">
        <div className="px-[5%] pt-[4%] text-center">
          <p className="text-sm text-white/45">现场投票 · 词云</p>
          <h1 className="mt-4 text-[clamp(24px,3vw,36px)] font-bold text-white">
            {data.title}
          </h1>
        </div>
        {data.showResults ? (
          <WordCloudView words={data.wordCloud ?? []} />
        ) : (
          <p className="flex flex-1 items-center justify-center text-white/40">
            收集进行中…
          </p>
        )}
      </div>
    );
  }

  if (!isChoicePoll) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-[#1a1d2e] text-white/60">
        <p>该互动类型暂不支持 PR5 投票大屏</p>
        <Link
          href={`/events/${eventId}/interactions/bigscreen`}
          className="text-[#2dd4bf] hover:underline"
        >
          打开互动大屏 →
        </Link>
      </div>
    );
  }

  return (
    <PollVotingBigScreen
      title={data.title}
      total={data.total}
      options={data.options}
      showResults={data.showResults}
    />
  );
}
