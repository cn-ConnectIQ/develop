"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { LotteryDrawType, LotteryStatus } from "@/lib/lottery/lottery-enums";
import { Download, Loader2, Upload, ArrowLeft, Monitor, QrCode } from "lucide-react";
import { toast } from "sonner";
import {
  AdminContent,
  AdminHeader,
  AdminPage,
} from "@/components/admin/admin-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { DrawControl } from "@/components/lottery/DrawControl";
import { ParticipantLotteryJoinQrDialog } from "@/components/lottery/ParticipantLotteryJoinQrDialog";
import { RealtimeEntryFeed } from "@/components/lottery/RealtimeEntryFeed";
import { WinnerList } from "@/components/lottery/WinnerList";
import { useRealtimeLotteryDashboard } from "@/hooks/useRealtimeLotteryDashboard";
import type { LotteryDashboardData } from "@/lib/lottery/lottery-dashboard-service";
import { withPublicPath } from "@/lib/public-path";
import { cn } from "@/lib/utils";

function AnimatedNumber({ value }: { value: number }) {
  const [display, setDisplay] = useState(value);
  const prev = useRef(value);

  useEffect(() => {
    const from = prev.current;
    const to = value;
    prev.current = value;
    if (from === to) return;

    const duration = 400;
    const start = performance.now();

    function tick(now: number) {
      const progress = Math.min((now - start) / duration, 1);
      setDisplay(Math.round(from + (to - from) * progress));
      if (progress < 1) requestAnimationFrame(tick);
    }

    requestAnimationFrame(tick);
  }, [value]);

  return <span className="tabular-nums">{display}</span>;
}

function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: number;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface p-5 shadow-sm">
      <p className="text-xs text-text-secondary">{label}</p>
      <p className={cn("mt-1 text-3xl font-bold", accent)}>
        <AnimatedNumber value={value} />
      </p>
      {sub && <p className="mt-1 text-xs text-text-secondary">{sub}</p>}
    </div>
  );
}

const DRAW_TYPE_LABEL: Record<LotteryDrawType, string> = {
  INSTANT: "即时开奖",
  SCHEDULED: "定时开奖",
  MANUAL: "手动触发",
};

export type LotteryDashboardProps = {
  eventId: string;
  lotteryId: string;
  initialData: LotteryDashboardData;
  /** 展位抽奖传展位编号；主办方抽奖传「主办方」等 */
  contextLabel: string;
};

export function LotteryDashboard({
  eventId,
  lotteryId,
  contextLabel,
  initialData,
}: LotteryDashboardProps) {
  const [data, setData] = useState(initialData);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [exportingMarketup, setExportingMarketup] = useState(false);
  const [joinQrOpen, setJoinQrOpen] = useState(false);
  const prevEntryCount = useRef(initialData.stats.participant_count);
  const isOrganizerContext = contextLabel === "主办方";

  const { refetch } = useRealtimeLotteryDashboard({
    lotteryId,
    eventId,
    onUpdate: (next) => {
      if (next.stats.participant_count > prevEntryCount.current) {
        setHighlightId(next.recent_entries[0]?.id ?? null);
        setTimeout(() => setHighlightId(null), 2000);
      }
      prevEntryCount.current = next.stats.participant_count;
      setData(next);
    },
  });

  const isFinished =
    data.lottery.status === LotteryStatus.FINISHED ||
    data.lottery.status === LotteryStatus.ENDED;

  const { A, B, C } = data.stats.intent_distribution;

  async function handleExportMarketup() {
    setExportingMarketup(true);
    try {
      const res = await fetch(
        withPublicPath(`/api/lotteries/${lotteryId}/export-marketup`),
        {
        method: "POST",
      });
      const json = (await res.json()) as {
        error?: string;
        data?: { queued: number };
      };
      if (!res.ok) throw new Error(json.error ?? "同步失败");
      toast.success(`已提交 ${json.data?.queued ?? 0} 条线索到 MarketUP 队列`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "同步失败");
    } finally {
      setExportingMarketup(false);
    }
  }

  function openBigScreen() {
    window.open(
      withPublicPath(
        `/events/${eventId}/interactions/bigscreen?mode=lottery&lottery=${lotteryId}`,
      ),
      "_blank",
    );
  }

  const listHref = `/events/${eventId}/lottery/participant`;

  return (
    <AdminPage>
      <AdminHeader
        title={data.lottery.title}
        description={`${contextLabel} · ${DRAW_TYPE_LABEL[data.lottery.draw_type]}`}
        breadcrumb={["互动管理", "参与人抽奖", "数据看板"]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {isOrganizerContext && !isFinished ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openBigScreen()}
                >
                  <Monitor className="mr-1.5 size-4" />
                  大屏
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setJoinQrOpen(true)}
                >
                  <QrCode className="mr-1.5 size-4" />
                  获取小程序扫码参与
                </Button>
              </>
            ) : null}
            <Link
              href={listHref}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <ArrowLeft className="mr-1.5 size-4" />
              返回列表
            </Link>
          </div>
        }
      />

      <AdminContent>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="参与人数"
            value={data.stats.participant_count}
            accent="text-brand-blue"
          />
          <StatCard
            label="线索采集"
            value={data.stats.lead_count}
            accent="text-brand-purple"
          />
          <StatCard
            label="已中奖"
            value={data.stats.winner_drawn}
            sub={`配额 ${data.stats.winner_quota}`}
            accent="text-brand-red"
          />
          <div className="rounded-lg border border-border bg-surface p-5 shadow-sm">
            <p className="text-xs text-text-secondary">AI 评级分布</p>
            <div className="mt-2 flex gap-3 text-sm font-semibold">
              <span className="text-brand-green">
                A <AnimatedNumber value={A} />
              </span>
              <span className="text-brand-amber">
                B <AnimatedNumber value={B} />
              </span>
              <span className="text-text-muted">
                C <AnimatedNumber value={C} />
              </span>
            </div>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
          <div className="space-y-6">
            <DrawControl
              lotteryId={lotteryId}
              drawType={data.lottery.draw_type}
              drawAt={data.lottery.draw_at}
              participantCount={data.stats.participant_count}
              winnerQuota={data.stats.winner_quota}
              isFinished={isFinished}
              onDrawComplete={() => void refetch()}
            />

            <WinnerList lotteryId={lotteryId} winners={data.winners} />

            <div className="flex flex-wrap gap-2">
              <a
                href={`/api/lotteries/${lotteryId}/export-leads`}
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                <Download className="mr-2 size-4" />
                导出所有线索
              </a>
              <Button
                variant="outline"
                disabled={exportingMarketup}
                onClick={() => void handleExportMarketup()}
              >
                {exportingMarketup ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : (
                  <Upload className="mr-2 size-4" />
                )}
                导出到 MarketUP
              </Button>
            </div>
          </div>

          <RealtimeEntryFeed
            entries={data.recent_entries}
            highlightId={highlightId}
          />
        </div>
      </AdminContent>

      {isOrganizerContext ? (
        <ParticipantLotteryJoinQrDialog
          open={joinQrOpen}
          onOpenChange={setJoinQrOpen}
          eventId={eventId}
          lotteryId={lotteryId}
          title={data.lottery.title}
        />
      ) : null}
    </AdminPage>
  );
}
