"use client";

import { useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  Gift,
  Loader2,
  MessageSquare,
  Trophy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type PollResults = {
  title: string;
  type: string;
  total: number;
  options: Array<{ text: string; count: number; percentage: number }>;
  qnaQuestions: Array<{
    id: string;
    text: string;
    likes: number;
    hidden: boolean;
  }>;
};

type LotteryResults = {
  title: string;
  status: string;
  entryCount: number;
  winners: Array<{
    prizeName: string;
    userName: string;
    userCompany: string | null;
  }>;
};

type ResultsPayload =
  | { kind: "poll"; leadCount: number; poll: PollResults }
  | {
      kind: "lottery";
      leadCount: number;
      lottery: LotteryResults;
    };

async function fetchResults(boothId: string, sessionId: string) {
  const res = await fetch(
    `/api/booths/${boothId}/interactions/${sessionId}/results`,
  );
  if (!res.ok) throw new Error("加载失败");
  return (await res.json()).data as ResultsPayload;
}

type BoothInteractionResultsProps = {
  boothId: string;
  sessionId: string;
  onDraw?: () => void;
  drawing?: boolean;
};

export function BoothInteractionResults({
  boothId,
  sessionId,
  onDraw,
  drawing,
}: BoothInteractionResultsProps) {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["booth-interaction-results", boothId, sessionId],
    queryFn: () => fetchResults(boothId, sessionId),
    refetchInterval: 5000,
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="size-6 animate-spin text-text-muted" />
      </div>
    );
  }

  if (!data) {
    return (
      <p className="py-8 text-center text-sm text-text-muted">暂无数据</p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-brand-amber-light/50 px-3 py-2 text-sm text-brand-amber">
        本互动带来 <strong>{data.leadCount}</strong> 条线索
        {data.leadCount > 0 ? "（含留资抽奖）" : ""}
      </div>

      {data.kind === "poll" && (
        <>
          <p className="text-sm text-text-muted">
            {data.poll.title} · 共 {data.poll.total} 人参与
          </p>
          {data.poll.type === "QNA" ? (
            <ul className="max-h-64 space-y-2 overflow-y-auto">
              {data.poll.qnaQuestions
                .filter((q) => !q.hidden)
                .map((q) => (
                  <li
                    key={q.id}
                    className="rounded-lg border border-border-light px-3 py-2 text-sm"
                  >
                    <p>{q.text}</p>
                    <p className="mt-1 text-xs text-text-muted">{q.likes} 赞</p>
                  </li>
                ))}
              {data.poll.qnaQuestions.length === 0 && (
                <li className="text-sm text-text-muted">暂无提问</li>
              )}
            </ul>
          ) : (
            <div className="space-y-2">
              {data.poll.options.map((opt) => (
                <div key={opt.text}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span>{opt.text}</span>
                    <span className="text-text-muted">
                      {opt.count} ({opt.percentage}%)
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-border-light">
                    <div
                      className="h-full rounded-full bg-brand-amber transition-all"
                      style={{ width: `${opt.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {data.kind === "lottery" && (
        <>
          <div className="flex items-center justify-between text-sm">
            <span>{data.lottery.title}</span>
            <span className="text-brand-amber">
              {data.lottery.entryCount} 人参与
            </span>
          </div>
          {data.lottery.status === "OPEN" && onDraw && (
            <Button
              type="button"
              className="w-full bg-brand-gold text-white hover:bg-brand-gold/90"
              disabled={drawing}
              onClick={onDraw}
            >
              {drawing ? "开奖中…" : "抽取一等奖"}
            </Button>
          )}
          {data.lottery.winners.length > 0 && (
            <ul className="space-y-2">
              <p className="text-xs font-medium text-text-muted">中奖名单</p>
              {data.lottery.winners.map((w, i) => (
                <li
                  key={`${w.userName}-${i}`}
                  className="rounded-lg border border-brand-gold/30 bg-[#FFFDF0] px-3 py-2 text-sm"
                >
                  <span className="font-medium">{w.userName}</span>
                  {w.userCompany && (
                    <span className="text-text-muted"> · {w.userCompany}</span>
                  )}
                  <span className="ml-2 text-brand-gold">{w.prizeName}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <button
        type="button"
        className="text-xs text-brand-blue hover:underline"
        onClick={() => void refetch()}
      >
        刷新数据
      </button>
    </div>
  );
}

export function BoothInteractionTypeIcon({
  subType,
  kind,
  className,
}: {
  subType: string;
  kind: "poll" | "lottery";
  className?: string;
}) {
  const Icon =
    kind === "lottery"
      ? Gift
      : subType === "QNA"
        ? MessageSquare
        : subType === "RATING"
          ? BarChart3
          : Trophy;
  return <Icon className={cn("size-5", className)} />;
}
