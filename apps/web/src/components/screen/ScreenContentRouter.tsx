"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { BigscreenProjection } from "@/components/bigscreen/BigscreenProjection";
import { QnaProjectionView } from "@/components/bigscreen/QnaProjectionView";
import { LotteryScreenDisplayClient } from "@/components/lottery/LotteryScreenDisplayClient";
import { useBigscreenRealtime } from "@/hooks/useBigscreenRealtime";
import { formatCountdown } from "@/lib/bigscreen-display";
import type { BigscreenPoll, PollOptionResult, WordCloudItem } from "@/lib/bigscreen-types";
import type { QnaQuestion } from "@/lib/bigscreen-display";
import type { ScreenPairingDisplayTarget } from "@/lib/screen-pairing/shared";

type PollResultsPayload = {
  pollId: string;
  title: string;
  type: string;
  status: string;
  showResults: boolean;
  closesAt: string | null;
  createdAt: string;
  total: number;
  options: PollOptionResult[];
  wordCloud: WordCloudItem[];
  qnaQuestions: QnaQuestion[];
  featuredQuestion: QnaQuestion | null;
};

type ScreenContentRouterProps = {
  eventId: string;
  eventName: string | null;
  interactionType: "POLL" | "LOTTERY" | "QA";
  interactionName: string | null;
  displayTarget: ScreenPairingDisplayTarget | null;
  usePolling: boolean;
};

async function fetchPollResults(
  eventId: string,
  pollId: string,
): Promise<PollResultsPayload> {
  const res = await fetch(
    `/api/events/${eventId}/polls/${pollId}/realtime-results`,
  );
  if (!res.ok) throw new Error("加载互动数据失败");
  const json = await res.json();
  return json.data as PollResultsPayload;
}

function PollScreenContent({
  eventId,
  pollId,
  usePolling,
}: {
  eventId: string;
  pollId: string;
  usePolling: boolean;
}) {
  const [data, setData] = useState<PollResultsPayload | null>(null);
  const [countdown, setCountdown] = useState("--:--");
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const next = await fetchPollResults(eventId, pollId);
      setData(next);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败");
    }
  }, [eventId, pollId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useBigscreenRealtime({
    eventId,
    pollId,
    enabled: !usePolling,
    onUpdate: reload,
  });

  useEffect(() => {
    if (!usePolling) return undefined;
    const timer = setInterval(() => {
      void reload();
    }, 3000);
    return () => clearInterval(timer);
  }, [usePolling, reload]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(formatCountdown(data?.closesAt ?? null));
    }, 1000);
    return () => clearInterval(timer);
  }, [data?.closesAt]);

  if (error) {
    return (
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "rgba(255,255,255,0.6)",
          fontSize: "24px",
        }}
      >
        {error}
      </div>
    );
  }

  if (!data) {
    return (
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "rgba(255,255,255,0.5)",
          fontSize: "22px",
        }}
      >
        加载互动内容…
      </div>
    );
  }

  const poll: BigscreenPoll = {
    id: data.pollId,
    title: data.title,
    type: data.type,
    status: data.status,
    showResults: data.showResults,
    closesAt: data.closesAt,
    createdAt: data.createdAt,
    responseCount: data.total,
  };

  const isQna = data.type === "QNA";
  const featuredQna =
    data.featuredQuestion ??
    data.qnaQuestions.find((q) => q.featured && !q.hidden) ??
    data.qnaQuestions.find((q) => !q.hidden) ??
    null;

  if (isQna) {
    return (
      <div
        style={{
          position: "relative",
          flex: 1,
          display: "flex",
          flexDirection: "column",
          backgroundColor: "#1A1A2E",
        }}
      >
        <div style={{ padding: "32px 32px 0" }}>
          <span
            style={{
              display: "inline-block",
              borderRadius: "9999px",
              backgroundColor: "#378ADD",
              color: "#fff",
              fontSize: "12px",
              padding: "6px 12px",
            }}
          >
            问答进行中
          </span>
          <h1
            style={{
              marginTop: "24px",
              textAlign: "center",
              fontSize: "clamp(24px, 3vw, 36px)",
              fontWeight: 700,
              color: "#fff",
              lineHeight: 1.35,
            }}
          >
            {data.title}
          </h1>
        </div>
        <QnaProjectionView question={featuredQna} />
      </div>
    );
  }

  return (
    <div
      style={{
        position: "relative",
        flex: 1,
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#1A1A2E",
      }}
    >
      <BigscreenProjection
        poll={poll}
        showResults={data.showResults}
        countdown={countdown}
        results={{ total: data.total, options: data.options }}
        wordCloud={data.wordCloud}
        qnaQuestions={data.qnaQuestions}
      />
    </div>
  );
}

function LotteryScreenContent({
  eventId,
  eventName,
  lotteryId,
}: {
  eventId: string;
  eventName: string;
  lotteryId: string;
}) {
  return (
    <div style={{ flex: 1, minHeight: 0, backgroundColor: "#0a0a12" }}>
      <Suspense
        fallback={
          <div
            style={{
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "rgba(255,255,255,0.5)",
            }}
          >
            加载抽奖大屏…
          </div>
        }
      >
        <LotteryScreenDisplayClient
          eventId={eventId}
          eventName={eventName}
          lotteryId={lotteryId}
          embedded
        />
      </Suspense>
    </div>
  );
}

export function ScreenContentRouter({
  eventId,
  eventName,
  interactionType,
  interactionName,
  displayTarget,
  usePolling,
}: ScreenContentRouterProps) {
  const pollId = displayTarget?.pollId ?? null;
  const lotteryId = displayTarget?.lotteryId ?? null;

  if (interactionType === "LOTTERY" && lotteryId) {
    return (
      <LotteryScreenContent
        eventId={eventId}
        eventName={eventName ?? "活动"}
        lotteryId={lotteryId}
      />
    );
  }

  if ((interactionType === "POLL" || interactionType === "QA") && pollId) {
    return (
      <PollScreenContent
        eventId={eventId}
        pollId={pollId}
        usePolling={usePolling}
      />
    );
  }

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        color: "rgba(255,255,255,0.65)",
        fontSize: "24px",
        gap: "12px",
      }}
    >
      <p>已连接：{interactionName ?? "互动"}</p>
      <p style={{ fontSize: "16px", color: "rgba(255,255,255,0.45)" }}>
        等待控制台推送内容…
      </p>
    </div>
  );
}
