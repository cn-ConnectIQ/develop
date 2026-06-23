"use client";

import { useCallback, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatCountdown } from "@/lib/bigscreen-display";
import type { BigscreenData } from "@/lib/bigscreen-types";
import type { BoothRankingItem } from "@/lib/booth-rankings-service";
import { useRealtimePollResults } from "@/hooks/useRealtimePollResults";
import { useRealtimeLottery } from "@/hooks/useRealtimeLottery";
import { useBigscreenStore } from "@/stores/bigscreenStore";
import { BigscreenProjection } from "@/components/interactions/bigscreen/BigscreenProjection";
import { BigscreenController } from "@/components/interactions/bigscreen/BigscreenController";
import { BigscreenTabBar } from "@/components/interactions/bigscreen/BigscreenTabBar";
import { BoothRankingDisplay } from "@/components/interactions/bigscreen/BoothRankingDisplay";
import { BoothRankingController } from "@/components/interactions/bigscreen/BoothRankingController";
import type { QnaListResult } from "@/lib/qna-service";
import { patchQnaResponse } from "@/hooks/useRealtimeQna";

async function fetchBigscreen(eventId: string): Promise<BigscreenData> {
  const res = await fetch(`/api/events/${eventId}/bigscreen/current`);
  if (!res.ok) throw new Error("加载失败");
  return (await res.json()).data as BigscreenData;
}

async function fetchRankings(eventId: string) {
  const res = await fetch(`/api/events/${eventId}/booth-rankings`);
  if (!res.ok) throw new Error("加载排行榜失败");
  return (await res.json()).data as {
    event_name: string;
    rankings: BoothRankingItem[];
  };
}

import { NetworkHeatDisplay } from "@/components/interactions/bigscreen/NetworkHeatDisplay";
export function InteractionsBigscreenClient({ eventId }: { eventId: string }) {
  const searchParams = useSearchParams();
  const lotteryId = searchParams.get("lottery");
  const modeParam = searchParams.get("mode");
  const queryClient = useQueryClient();

  const projectionTab = useBigscreenStore((s) => s.projectionTab);
  const bumpBoothRankingRefresh = useBigscreenStore((s) => s.bumpBoothRankingRefresh);
  const boothRankingRefreshNonce = useBigscreenStore((s) => s.boothRankingRefreshNonce);

  const setEvent = useBigscreenStore((s) => s.setEvent);
  const deriveModeFromPoll = useBigscreenStore((s) => s.deriveModeFromPoll);
  const setCurrentPoll = useBigscreenStore((s) => s.setCurrentPoll);
  const setShowResults = useBigscreenStore((s) => s.setShowResults);
  const setQueue = useBigscreenStore((s) => s.setQueue);
  const setStats = useBigscreenStore((s) => s.setStats);
  const setPollResults = useBigscreenStore((s) => s.setPollResults);
  const setFeaturedQna = useBigscreenStore((s) => s.setFeaturedQna);
  const setCountdown = useBigscreenStore((s) => s.setCountdown);
  const setPrizeStatus = useBigscreenStore((s) => s.setPrizeStatus);
  const setCurrentWinner = useBigscreenStore((s) => s.setCurrentWinner);
  const setIsRollingSettled = useBigscreenStore((s) => s.setIsRollingSettled);
  const addWinners = useBigscreenStore((s) => s.addWinners);

  const { data } = useQuery({
    queryKey: ["bigscreen", eventId],
    queryFn: () => fetchBigscreen(eventId),
    refetchInterval: 10_000,
  });

  const { data: rankingMeta } = useQuery({
    queryKey: ["booth-rankings-meta", eventId],
    queryFn: () => fetchRankings(eventId),
    staleTime: 5 * 60 * 1000,
  });

  const { data: rankingData } = useQuery({
    queryKey: ["booth-rankings", eventId, boothRankingRefreshNonce],
    queryFn: () => fetchRankings(eventId),
    enabled: projectionTab === "booth_ranking",
    refetchInterval: projectionTab === "booth_ranking" ? 60_000 : false,
  });

  const livePoll = data?.livePoll ?? null;

  const { data: pollResults, refetch: refetchPoll } = useRealtimePollResults({
    eventId,
    pollId: livePoll?.id ?? null,
    enabled: !!livePoll && !lotteryId,
  });

  useRealtimeLottery({
    eventId,
    lotteryId,
    enabled: Boolean(lotteryId),
  });

  const { data: qnaData } = useQuery({
    queryKey: ["qna-bigscreen", eventId, livePoll?.id],
    queryFn: async () => {
      if (!livePoll || livePoll.type !== "QNA") return null;
      const res = await fetch(
        `/api/events/${eventId}/polls/${livePoll.id}/responses`,
      );
      if (!res.ok) return null;
      return (await res.json()).data as QnaListResult;
    },
    enabled: livePoll?.type === "QNA",
    refetchInterval: 5000,
  });

  useEffect(() => {
    const name = rankingData?.event_name ?? rankingMeta?.event_name ?? "活动现场";
    setEvent(eventId, name);
  }, [eventId, data, rankingData, rankingMeta, setEvent]);

  useEffect(() => {
    if (lotteryId || modeParam === "lottery") return;
    deriveModeFromPoll(livePoll);
    setCurrentPoll(livePoll);
    if (data?.display?.showResults !== undefined) {
      setShowResults(data.display.showResults);
    }
    const queueItems = [
      ...(data?.queue.next ? [data.queue.next] : []),
      ...(data?.queue.drafts ?? []),
    ];
    setQueue(queueItems);
    if (data?.stats) setStats(data.stats);
  }, [
    livePoll,
    data,
    lotteryId,
    modeParam,
    deriveModeFromPoll,
    setCurrentPoll,
    setShowResults,
    setQueue,
    setStats,
  ]);

  useEffect(() => {
    if (pollResults) {
      setPollResults(pollResults);
      if (livePoll?.type === "QNA") {
        const onScreen =
          qnaData?.onScreenResponse ??
          qnaData?.responses.find((r) => r.isOnScreen) ??
          null;
        setFeaturedQna(
          onScreen
            ? {
                id: onScreen.id,
                text: onScreen.textAnswer,
                likes: onScreen.upvoteCount,
                hidden: onScreen.isHidden,
                pinned: onScreen.isPinned,
                answered: onScreen.isAnswered,
                featured: true,
                onScreen: true,
                createdAt: onScreen.createdAt,
              }
            : null,
        );
      }
    }
  }, [
    pollResults,
    livePoll,
    qnaData,
    setPollResults,
    setFeaturedQna,
  ]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(formatCountdown(livePoll?.closesAt ?? null));
    }, 1000);
    return () => clearInterval(timer);
  }, [livePoll?.closesAt, setCountdown]);

  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["bigscreen", eventId] });
    void refetchPoll();
  }, [queryClient, eventId, refetchPoll]);

  const refreshRankings = useCallback(() => {
    bumpBoothRankingRefresh();
    void queryClient.invalidateQueries({ queryKey: ["booth-rankings", eventId] });
  }, [bumpBoothRankingRefresh, queryClient, eventId]);

  async function patchPoll(pollId: string, body: Record<string, unknown>) {
    await fetch(`/api/events/${eventId}/polls/${pollId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    refresh();
  }

  async function patchDisplay(pollId: string, body: Record<string, unknown>) {
    await fetch(`/api/events/${eventId}/polls/${pollId}/display`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    refresh();
  }

  async function publishPoll(pollId: string) {
    await fetch(`/api/events/${eventId}/polls/${pollId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "LIVE" }),
    });
    refresh();
  }

  async function drawPrize(prizeRank: number, count: number) {
    if (!lotteryId) return;
    const res = await fetch(
      `/api/events/${eventId}/lotteries/${lotteryId}/draw`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prize_rank: prizeRank, count }),
      },
    );
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      throw new Error(json.message ?? "抽取失败");
    }
    const json = await res.json();
    const winners = json.data as Array<{
      id: string;
      userId: string;
      name: string;
      company: string | null;
      prizeRank: number;
      prizeName: string;
    }>;
    if (winners[0]) {
      setPrizeStatus(prizeRank, "done");
      setCurrentWinner({
        id: winners[0].userId,
        name: winners[0].name,
        company: winners[0].company,
      });
      setIsRollingSettled(true);
      addWinners(
        winners.map((w) => ({
          id: w.id,
          name: w.name,
          company: w.company,
          prizeRank: w.prizeRank,
          prizeName: w.prizeName,
        })),
      );
    }
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      <div className="relative flex flex-[0_0_72%] flex-col overflow-hidden">
        <BigscreenTabBar />
        {projectionTab === "interaction" && <BigscreenProjection />}
        {projectionTab === "booth_ranking" && (
          <BoothRankingDisplay eventId={eventId} />
        )}
        {projectionTab === "network_heat" && <NetworkHeatDisplay eventId={eventId} />}
      </div>

      {projectionTab === "booth_ranking" ? (
        <BoothRankingController
          eventId={eventId}
          rankings={rankingData?.rankings}
          onRefresh={refreshRankings}
        />
      ) : (
        <BigscreenController
          eventId={eventId}
          qnaItems={qnaData?.responses ?? []}
          onRefresh={refresh}
          onPatchPoll={patchPoll}
          onPatchDisplay={patchDisplay}
          onPublishPoll={publishPoll}
          onQnaAction={async (responseId, action) => {
            if (!livePoll) return;
            if (action === "on_screen") {
              await patchQnaResponse(eventId, livePoll.id, responseId, {
                is_on_screen: true,
              });
            } else {
              await patchQnaResponse(eventId, livePoll.id, responseId, {
                is_hidden: true,
              });
            }
            refresh();
          }}
          onDrawPrize={drawPrize}
        />
      )}
    </div>
  );
}
