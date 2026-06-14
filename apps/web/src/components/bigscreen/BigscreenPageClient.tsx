"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BigscreenHostPanel } from "@/components/bigscreen/BigscreenHostPanel";
import { BigscreenProjection } from "@/components/bigscreen/BigscreenProjection";
import { useBigscreenRealtime } from "@/hooks/useBigscreenRealtime";
import { formatCountdown } from "@/lib/bigscreen-display";
import type { BigscreenData } from "@/lib/bigscreen-types";

async function fetchBigscreen(eventId: string): Promise<BigscreenData> {
  const res = await fetch(`/api/events/${eventId}/bigscreen/current`);
  if (!res.ok) throw new Error("加载失败");
  return (await res.json()).data as BigscreenData;
}

export function BigscreenPageClient() {
  const params = useParams<{ eventId: string }>();
  const eventId = params.eventId;
  const queryClient = useQueryClient();
  const [showResults, setShowResults] = useState(true);
  const [countdown, setCountdown] = useState("--:--");

  const { data } = useQuery({
    queryKey: ["bigscreen", eventId],
    queryFn: () => fetchBigscreen(eventId),
    refetchInterval: 8000,
    enabled: !!eventId,
  });

  const poll = data?.livePoll;

  useBigscreenRealtime({
    eventId,
    pollId: poll?.id,
    enabled: !!eventId,
    onUpdate: useCallback(() => {
      void queryClient.invalidateQueries({ queryKey: ["bigscreen", eventId] });
    }, [eventId, queryClient]),
  });

  useEffect(() => {
    const effective = data?.display?.showResults ?? data?.livePoll?.showResults;
    if (effective !== undefined) setShowResults(effective);
  }, [
    data?.display?.showResults,
    data?.livePoll?.showResults,
    data?.livePoll?.id,
  ]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(formatCountdown(data?.livePoll?.closesAt ?? null));
    }, 1000);
    return () => clearInterval(timer);
  }, [data?.livePoll?.closesAt]);

  async function patchPoll(pollId: string, body: Record<string, unknown>) {
    await fetch(`/api/events/${eventId}/polls/${pollId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    void queryClient.invalidateQueries({ queryKey: ["bigscreen", eventId] });
  }

  async function patchDisplay(
    pollId: string,
    body: Record<string, unknown>,
  ) {
    await fetch(`/api/events/${eventId}/polls/${pollId}/display`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    void queryClient.invalidateQueries({ queryKey: ["bigscreen", eventId] });
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      <div className="relative flex w-[70%] flex-col bg-sidebar-shell">
        {poll ? (
          <BigscreenProjection
            poll={poll}
            showResults={showResults}
            countdown={countdown}
            results={data?.results ?? null}
            wordCloud={data?.wordCloud ?? []}
            qnaQuestions={data?.qnaQuestions ?? []}
          />
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center text-white/60">
            <p className="text-xl">暂无进行中的互动</p>
            <Link
              href={`/events/${eventId}/interactions`}
              className="mt-4 text-brand-blue"
            >
              前往互动管理发布 →
            </Link>
          </div>
        )}
      </div>

      <BigscreenHostPanel
        poll={poll ?? null}
        data={data}
        countdown={countdown}
        showResults={showResults}
        onShowResultsChange={setShowResults}
        onPatchPoll={patchPoll}
        onPatchDisplay={patchDisplay}
      />
    </div>
  );
}
