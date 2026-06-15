"use client";

import {
  BarChart2,
  CheckCircle,
  Cloud,
  Gift,
  Loader2,
  MessageSquare,
  RefreshCw,
  Star,
  ToggleLeft,
} from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { useBigscreenStore } from "@/stores/bigscreenStore";
import { prizeRankBadgeClass, prizeRankLabel } from "@/lib/lottery-types";
import type { QnaResponseItem } from "@/lib/qna-service";

const TYPE_ICONS: Record<string, typeof ToggleLeft> = {
  SINGLE_CHOICE: ToggleLeft,
  MULTI_CHOICE: BarChart2,
  WORD_CLOUD: Cloud,
  RATING: Star,
  QNA: MessageSquare,
  LOTTERY: Gift,
};

type BigscreenControllerProps = {
  eventId: string;
  qnaItems?: QnaResponseItem[];
  newQnaCount?: number;
  onRefresh: () => void;
  onPatchPoll: (pollId: string, body: Record<string, unknown>) => Promise<void>;
  onPatchDisplay: (
    pollId: string,
    body: Record<string, unknown>,
  ) => Promise<void>;
  onPublishPoll: (pollId: string) => Promise<void>;
  onQnaAction?: (
    responseId: string,
    action: "on_screen" | "hidden",
  ) => Promise<void>;
  onDrawPrize?: (prizeRank: number, count: number) => Promise<void>;
};

export function BigscreenController({
  eventId,
  qnaItems = [],
  newQnaCount = 0,
  onRefresh,
  onPatchPoll,
  onPatchDisplay,
  onPublishPoll,
  onQnaAction,
  onDrawPrize,
}: BigscreenControllerProps) {
  const eventName = useBigscreenStore((s) => s.eventName);
  const currentMode = useBigscreenStore((s) => s.currentMode);
  const currentPoll = useBigscreenStore((s) => s.currentPoll);
  const pollResults = useBigscreenStore((s) => s.pollResults);
  const showResults = useBigscreenStore((s) => s.showResults);
  const lockVotes = useBigscreenStore((s) => s.lockVotes);
  const countdown = useBigscreenStore((s) => s.countdown);
  const queue = useBigscreenStore((s) => s.queue);
  const stats = useBigscreenStore((s) => s.stats);
  const setShowResults = useBigscreenStore((s) => s.setShowResults);
  const setLockVotes = useBigscreenStore((s) => s.setLockVotes);
  const lotteryTitle = useBigscreenStore((s) => s.lotteryTitle);
  const lotteryEntryCount = useBigscreenStore((s) => s.lotteryEntryCount);
  const lotteryPrizes = useBigscreenStore((s) => s.lotteryPrizes);
  const prizeStatuses = useBigscreenStore((s) => s.prizeStatuses);
  const setMode = useBigscreenStore((s) => s.setMode);
  const setActivePrizeRank = useBigscreenStore((s) => s.setActivePrizeRank);
  const setPrizeStatus = useBigscreenStore((s) => s.setPrizeStatus);
  const setIsRollingSettled = useBigscreenStore((s) => s.setIsRollingSettled);
  const setIsRollingPaused = useBigscreenStore((s) => s.setIsRollingPaused);
  const isRollingPaused = useBigscreenStore((s) => s.isRollingPaused);
  const resetRolling = useBigscreenStore((s) => s.resetRolling);
  const currentWinner = useBigscreenStore((s) => s.currentWinner);

  const isLotteryMode = currentMode.startsWith("lottery");
  const isQna = currentPoll?.type === "QNA";
  const total = pollResults?.total ?? currentPoll?.responseCount ?? 0;

  async function handleDraw(rank: number, count: number) {
    setPrizeStatus(rank, "drawing");
    setActivePrizeRank(rank);
    resetRolling();
    setMode("lottery_drawing");
    try {
      await onDrawPrize?.(rank, count);
    } catch (e) {
      setPrizeStatus(rank, "pending");
      toast.error(e instanceof Error ? e.message : "抽取失败");
    }
  }

  return (
    <aside className="relative flex flex-[0_0_28%] flex-col overflow-y-auto bg-[#0D1117] pb-20 text-white">
      <div className="border-b border-white/10 p-4">
        <p className="truncate text-sm font-medium">{eventName}</p>
        <p className="mt-0.5 text-xs text-white/40">ConnectIQ 控制台</p>
      </div>

      {!isLotteryMode && (
        <>
          <div className="border-b border-white/10 p-4">
            {currentPoll ? (
              <>
                <p className="line-clamp-2 text-[13px] font-medium">
                  {currentPoll.title}
                </p>
                <div className="mt-2 flex gap-4">
                  <div>
                    <span className="text-xl font-bold text-brand-blue">
                      {total}
                    </span>
                    <span className="ml-1 text-xs text-white/60">参与</span>
                  </div>
                  {countdown !== "--:--" && (
                    <div>
                      <span className="font-mono text-xl font-bold text-brand-amber">
                        {countdown}
                      </span>
                      <span className="ml-1 text-xs text-white/60">剩余</span>
                    </div>
                  )}
                </div>
                <div className="mt-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-white/60">显示实时结果</span>
                    <Switch
                      checked={showResults}
                      onCheckedChange={async (v) => {
                        setShowResults(v);
                        await onPatchDisplay(currentPoll.id, {
                          show_results: v,
                        });
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-white/60">锁定投票</span>
                    <Switch
                      checked={lockVotes}
                      onCheckedChange={setLockVotes}
                    />
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    className="h-9 rounded-lg border border-brand-amber/30 bg-brand-amber/20 text-sm text-brand-amber"
                    onClick={() =>
                      void onPatchPoll(currentPoll.id, { status: "PAUSED" })
                    }
                  >
                    ⏸ 暂停
                  </button>
                  <button
                    type="button"
                    className="h-9 rounded-lg border border-brand-red/30 bg-brand-red/20 text-sm text-brand-red"
                    onClick={() =>
                      void onPatchPoll(currentPoll.id, { status: "CLOSED" })
                    }
                  >
                    ⏹ 结束
                  </button>
                  <button
                    type="button"
                    className="h-9 rounded-lg bg-white/10 text-sm text-white"
                    onClick={() =>
                      void onPatchPoll(currentPoll.id, { extendMinutes: 2 })
                    }
                  >
                    +2 分钟
                  </button>
                  <button
                    type="button"
                    className="flex h-9 items-center justify-center gap-1 rounded-lg bg-white/10 text-sm text-white"
                    onClick={onRefresh}
                  >
                    <RefreshCw className="size-3.5" />
                    全屏刷新
                  </button>
                </div>
              </>
            ) : (
              <p className="text-xs text-white/40">暂无进行中的互动</p>
            )}
          </div>

          <div className="border-b border-white/10 p-4">
            <p className="mb-2 text-[11px] uppercase tracking-widest text-white/40">
              互动队列
            </p>
            {queue.length === 0 ? (
              <p className="py-2 text-center text-xs text-white/30">
                暂无待发布互动
              </p>
            ) : (
              queue.map((item) => {
                const Icon = TYPE_ICONS[item.type] ?? ToggleLeft;
                return (
                  <div
                    key={item.id}
                    className="group mb-1 flex items-center gap-3 rounded-lg bg-white/5 p-3"
                  >
                    <Icon className="size-3.5 text-white/60" />
                    <span className="flex-1 truncate text-sm">{item.title}</span>
                    <button
                      type="button"
                      className="text-xs text-brand-blue opacity-0 hover:text-brand-blue/80 group-hover:opacity-100"
                      onClick={() => void onPublishPoll(item.id)}
                    >
                      ▶ 发布
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {isQna && (
            <div className="border-b border-white/10 p-4">
              <div className="flex items-center justify-between">
                <p className="text-[11px] uppercase tracking-widest text-white/40">
                  问题队列
                </p>
                {newQnaCount > 0 && (
                  <span className="rounded bg-brand-blue px-1.5 text-[10px] text-white">
                    新 {newQnaCount}
                  </span>
                )}
              </div>
              <div className="mt-2 max-h-[280px] space-y-1.5 overflow-y-auto">
                {qnaItems.slice(0, 20).map((item) => (
                  <div key={item.id} className="rounded-lg bg-white/5 p-3">
                    <p className="line-clamp-2 text-xs text-white">
                      {item.textAnswer}
                    </p>
                    <div className="mt-2 flex justify-between">
                      <span className="text-[11px] text-white/40">
                        ❤ {item.upvoteCount}
                      </span>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="text-xs text-brand-blue"
                          onClick={() => void onQnaAction?.(item.id, "on_screen")}
                        >
                          上屏
                        </button>
                        <button
                          type="button"
                          className="text-xs text-white/40"
                          onClick={() => void onQnaAction?.(item.id, "hidden")}
                        >
                          隐藏
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {isLotteryMode && (
        <>
          <div className="border-b border-white/10 p-4">
            <p className="font-medium">🎲 抽奖控制台</p>
            <p className="mt-0.5 text-xs text-white/60">
              奖池：{lotteryEntryCount} 人参与
            </p>
            <p className="mt-1 truncate text-xs text-white/40">{lotteryTitle}</p>
          </div>
          <div className="space-y-2 p-4">
            {[...lotteryPrizes]
              .sort((a, b) => b.rank - a.rank)
              .map((prize) => {
                const status = prizeStatuses[prize.rank] ?? "pending";
                return (
                  <div
                    key={prize.rank}
                    className="flex items-center rounded-lg bg-white/5 p-3"
                  >
                    <span
                      className={cn(
                        "mr-2 rounded px-1.5 py-0.5 text-[10px] font-bold",
                        prizeRankBadgeClass(prize.rank),
                      )}
                    >
                      {prizeRankLabel(prize.rank)}
                    </span>
                    <span className="flex-1 truncate text-sm">
                      {prize.prize || prize.name}
                    </span>
                    <span className="mr-2 text-xs text-white/40">
                      ×{prize.count ?? 1}
                    </span>
                    {status === "pending" && (
                      <button
                        type="button"
                        className="h-8 rounded bg-brand-red px-3 text-xs text-white"
                        onClick={() =>
                          void handleDraw(prize.rank, prize.count ?? 1)
                        }
                      >
                        ▶ 抽取
                      </button>
                    )}
                    {status === "drawing" && (
                      <Loader2 className="size-4 animate-spin text-white/60" />
                    )}
                    {status === "done" && (
                      <CheckCircle className="size-4 text-brand-green" />
                    )}
                  </div>
                );
              })}
          </div>
          <div className="space-y-2 p-4">
            <button
              type="button"
              className="h-10 w-full rounded-lg bg-white/10 text-sm text-white"
              onClick={() => setIsRollingPaused(!isRollingPaused)}
            >
              ⏸ 暂停滚动
            </button>
            <button
              type="button"
              className="h-10 w-full rounded-lg bg-white/10 text-sm text-white"
              onClick={() => {
                if (currentWinner) {
                  setIsRollingSettled(true);
                }
              }}
            >
              ⏭ 快速定格
            </button>
            <button
              type="button"
              className="h-10 w-full rounded-lg bg-brand-gold/20 text-sm text-brand-gold"
              onClick={() => setMode("lottery_result")}
            >
              📋 查看获奖名单
            </button>
          </div>
        </>
      )}

      <div className="fixed bottom-0 right-0 w-[28%] border-t border-white/10 bg-[#0D1117] p-4 text-center">
        <p className="text-xs text-white/30">
          在场 {stats.onSite} 人 · 参与率 {stats.participationRate}%
        </p>
      </div>
    </aside>
  );
}
