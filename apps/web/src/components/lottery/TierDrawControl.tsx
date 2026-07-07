"use client";

import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
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
import type { LotteryTierState } from "@/lib/lottery/lottery-screen-service";
import { tierMedal } from "@/lib/lottery/organizer-lottery-config";

export type TierDrawMode = "ONE" | "ALL";

type TierDrawControlProps = {
  tier: LotteryTierState;
  drawing: boolean;
  onDraw: (mode: TierDrawMode) => Promise<void>;
  /** 嵌入顶部焦点卡片时使用紧凑布局，省略重复标题 */
  embedded?: boolean;
};

export function TierDrawControl({
  tier,
  drawing,
  onDraw,
  embedded = false,
}: TierDrawControlProps) {
  const [mode, setMode] = useState<TierDrawMode>("ONE");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const remaining = Math.max(0, tier.quantity - tier.drawn_count);
  const nextSlot = tier.drawn_count + 1;

  const buttonLabel = useMemo(() => {
    if (tier.complete || remaining <= 0) {
      return "本等级已全部抽出 ✓";
    }
    if (mode === "ONE") {
      return `抽取第 ${nextSlot} 位获奖者`;
    }
    return `一次性抽出剩余 ${remaining} 位`;
  }, [mode, nextSlot, remaining, tier.complete]);

  const confirmText = useMemo(() => {
    if (mode === "ONE") {
      return `确认抽取${tier.label}的第 ${nextSlot} 位获奖者？`;
    }
    return `确认一次性抽出${tier.label}剩余全部 ${remaining} 位获奖者？`;
  }, [mode, nextSlot, remaining, tier.label]);

  if (tier.complete) {
    return (
      <div
        className={cn(
          "rounded-xl border border-brand-green/30 bg-brand-green/10 px-4 py-3 text-center text-sm font-medium text-[#7DE0BE]",
          embedded && "border-0 bg-transparent py-2",
        )}
      >
        {tierMedal(tier.tier)} {tier.label} 已全部抽出 ✓
      </div>
    );
  }

  if (!tier.is_active) return null;

  const modeSection = (
    <div className={cn("space-y-2", embedded && "flex-1 min-w-0")}>
      <p className="text-xs font-semibold tracking-wide text-white/40">抽取模式</p>
      <div className={cn("grid gap-2 sm:grid-cols-2")}>
        <button
          type="button"
          onClick={() => setMode("ONE")}
          className={cn(
            "rounded-xl border px-4 py-3 text-left text-sm transition-colors",
            mode === "ONE"
              ? "border-brand-green/50 bg-brand-green/15 text-[#7DE0BE]"
              : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10",
          )}
        >
          <span className="font-semibold">逐个抽取</span>
          <p className="mt-1 text-xs opacity-80">
            每次揭晓 1 位，更有悬念，适合现场慢慢开
          </p>
        </button>
        <button
          type="button"
          onClick={() => setMode("ALL")}
          className={cn(
            "rounded-xl border px-4 py-3 text-left text-sm transition-colors",
            mode === "ALL"
              ? "border-brand-purple/50 bg-brand-purple/15 text-[#D4D0FF]"
              : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10",
          )}
        >
          <span className="font-semibold">一次性抽完</span>
          <p className="mt-1 text-xs opacity-80">
            直接抽出剩余全部名额，适合名额多想尽快完成
          </p>
        </button>
      </div>
    </div>
  );

  const drawButton = (
    <Button
      className={cn(
        "rounded-xl bg-gradient-to-br from-brand-green to-[#0B8A69] text-lg font-bold text-white hover:from-brand-green/90",
        embedded ? "h-12 shrink-0 px-6 sm:h-auto sm:min-h-[88px] sm:w-52" : "h-14 w-full",
      )}
      disabled={drawing || remaining <= 0}
      onClick={() => setConfirmOpen(true)}
    >
      {drawing ? (
        <>
          <Loader2 className="mr-2 size-5 animate-spin" />
          抽取中…
        </>
      ) : (
        buttonLabel
      )}
    </Button>
  );

  return (
    <>
      {embedded ? (
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
          {modeSection}
          {drawButton}
        </div>
      ) : (
        <div className="space-y-4 rounded-2xl border border-white/10 bg-[#1A2035] p-5">
          <div>
            <p className="text-sm text-white/50">
              {tier.label} · 共 {tier.quantity} 个名额 · 已抽出 {tier.drawn_count}/
              {tier.quantity}
            </p>
            <p className="mt-1 text-lg font-bold text-brand-gold">{tier.prize_name}</p>
          </div>
          {modeSection}
          {drawButton}
        </div>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="border-white/10 bg-[#1A2035] text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>确认抽取</AlertDialogTitle>
            <AlertDialogDescription className="text-white/60">
              {confirmText}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-white/15 bg-transparent text-white/70">
              取消
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-brand-green text-white hover:bg-brand-green/90"
              onClick={() => {
                setConfirmOpen(false);
                void onDraw(mode);
              }}
            >
              确认
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
