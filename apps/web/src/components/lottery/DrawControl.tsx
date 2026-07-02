"use client";

import { useEffect, useMemo, useState } from "react";
import { LotteryDrawType } from "@/lib/lottery/lottery-enums";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type DrawControlProps = {
  lotteryId: string;
  drawType: LotteryDrawType;
  drawAt: string | null;
  participantCount: number;
  winnerQuota: number;
  isFinished: boolean;
  onDrawComplete: () => void;
};

function formatCountdown(ms: number) {
  if (ms <= 0) return "00:00:00";
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

export function DrawControl({
  lotteryId,
  drawType,
  drawAt,
  participantCount,
  winnerQuota,
  isFinished,
  onDrawComplete,
}: DrawControlProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [autoDrawTriggered, setAutoDrawTriggered] = useState(false);

  const targetMs = drawAt ? new Date(drawAt).getTime() : null;
  const remaining = targetMs != null ? targetMs - now : null;

  useEffect(() => {
    if (drawType !== LotteryDrawType.SCHEDULED || !targetMs) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [drawType, targetMs]);

  const canManualDraw =
    !isFinished &&
    (drawType === LotteryDrawType.MANUAL ||
      drawType === LotteryDrawType.SCHEDULED);

  async function handleDraw() {
    setDrawing(true);
    try {
      const res = await fetch(`/api/lotteries/${lotteryId}/draw`, {
        method: "POST",
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "开奖失败");
      toast.success("开奖完成");
      onDrawComplete();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "开奖失败");
    } finally {
      setDrawing(false);
      setConfirmOpen(false);
    }
  }

  useEffect(() => {
    if (
      drawType !== LotteryDrawType.SCHEDULED ||
      isFinished ||
      autoDrawTriggered ||
      remaining == null ||
      remaining > 0
    ) {
      return;
    }

    setAutoDrawTriggered(true);
    void handleDraw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawType, isFinished, autoDrawTriggered, remaining]);

  const countdownLabel = useMemo(() => {
    if (remaining == null) return null;
    return formatCountdown(remaining);
  }, [remaining]);

  if (isFinished) {
    return (
      <div className="rounded-xl border border-border-light bg-white p-6 text-center">
        <p className="text-sm font-medium text-text-muted">抽奖已结束</p>
      </div>
    );
  }

  if (drawType === LotteryDrawType.INSTANT) {
    return (
      <div className="rounded-xl border border-border-light bg-white p-6">
        <p className="text-sm text-text-muted">
          即时开奖模式：参会者参与后立即得知结果，无需手动开奖。
        </p>
        <p className="mt-2 text-2xl font-bold tabular-nums">
          {participantCount}
          <span className="ml-1 text-sm font-normal text-text-muted">
            人已参与
          </span>
        </p>
      </div>
    );
  }

  if (drawType === LotteryDrawType.SCHEDULED && countdownLabel) {
    return (
      <div className="rounded-xl border border-border-light bg-white p-8 text-center">
        <p className="text-sm text-text-muted">距离开奖还有</p>
        <p
          className={cn(
            "mt-2 font-mono text-5xl font-bold tabular-nums tracking-wider",
            remaining != null && remaining <= 0
              ? "text-brand-green"
              : "text-brand-blue",
          )}
        >
          {countdownLabel}
        </p>
        <p className="mt-4 text-xs text-text-muted">
          时间到达后将自动开奖（共 {participantCount} 人参与，抽出{" "}
          {winnerQuota} 位）
        </p>
        {drawing && (
          <p className="mt-3 flex items-center justify-center gap-2 text-sm text-brand-gold">
            <Loader2 className="size-4 animate-spin" />
            正在开奖…
          </p>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="rounded-xl border border-border-light bg-white p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">手动开奖</p>
            <p className="text-xs text-text-muted">
              {participantCount} 名参与者 · 将抽出 {winnerQuota} 位幸运儿
            </p>
          </div>
        </div>
        <Button
          size="lg"
          disabled={!canManualDraw || drawing || participantCount === 0}
          className="h-14 w-full bg-brand-gold text-base font-semibold text-white hover:bg-brand-gold/90"
          onClick={() => setConfirmOpen(true)}
        >
          {drawing ? (
            <>
              <Loader2 className="mr-2 size-5 animate-spin" />
              开奖中…
            </>
          ) : (
            <>
              <Sparkles className="mr-2 size-5" />
              立即开奖
            </>
          )}
        </Button>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认开奖？</AlertDialogTitle>
            <AlertDialogDescription>
              即将从 {participantCount} 名参与者中抽出 {winnerQuota}{" "}
              位幸运儿，确认开奖？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-brand-gold hover:bg-brand-gold/90"
              onClick={() => void handleDraw()}
            >
              确认开奖
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
