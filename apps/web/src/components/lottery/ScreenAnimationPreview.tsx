"use client";

import type { ScreenAnimationType } from "@/lib/lottery/organizer-lottery-config";
import { tierLabel } from "@/lib/lottery/organizer-lottery-config";
import { SlotMachineAnimation } from "@/components/lottery/SlotMachineAnimation";
import { cn } from "@/lib/utils";

export type ScreenAnimationPreviewProps = {
  animation: ScreenAnimationType;
  title: string;
  tier?: number;
  entryCount?: number;
};

function ScrollListPreview({ active }: { active?: boolean }) {
  const rows = [
    "王磊 · 恒光科技",
    "陈静 · 星图数据",
    "赵敏 · 云拓科技",
    "李强 · 智链未来",
    "王磊 · 恒光科技",
    "陈静 · 星图数据",
  ];
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-4">
      <p className="text-xs font-bold text-white/60">一等奖抽奖中</p>
      <div className="relative h-24 w-full max-w-[200px] overflow-hidden">
        <div className={cn("flex flex-col items-center gap-2", active && "animate-ciq-name-scroll")}>
          {rows.map((row, i) => (
            <span
              key={`${row}-${i}`}
              className={cn(
                "whitespace-nowrap text-xs text-white/50",
                i === 2 && "text-sm font-extrabold text-brand-gold",
              )}
            >
              {row}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ScreenAnimationPreview({
  animation,
  title,
  tier = 1,
  entryCount = 328,
}: ScreenAnimationPreviewProps) {
  const label = tierLabel(tier);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <p className="text-xs font-semibold tracking-widest text-white/50">
        大屏投影预览
      </p>
      <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-white/10 bg-[#0D0D1F]">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(83,74,183,0.25)_0%,transparent_65%)]" />
        {animation === "SLOT_MACHINE" ? (
          <SlotMachineAnimation
            compact
            phase="animating"
            tierLabel={label}
            entryCount={entryCount}
            balls={[
              { initial: "王", color: "#534AB7", bg: "#D4D0FF" },
              { initial: "陈", color: "#B77A12", bg: "#FFE4B5" },
              { initial: "赵", color: "#2E7D32", bg: "#C8E6C9" },
            ]}
            outletBall={{ initial: "李", color: "#534AB7", bg: "#D4D0FF" }}
          />
        ) : animation === "REVEAL_ONE_BY_ONE" ? (
          <ScrollListPreview active />
        ) : animation === "WHEEL" ? (
          <div className="flex h-full items-center justify-center">
            <div
              className="size-24 animate-spin rounded-full bg-[conic-gradient(#0F6E56_0_60deg,#EF9F27_60deg_120deg,#C77A1B_120deg_180deg,#0F6E56_180deg_240deg,#EF9F27_240deg_300deg,#C77A1B_300deg_360deg)]"
              style={{ animationDuration: "3s" }}
            />
          </div>
        ) : (
          <div className="flex h-full items-center justify-center gap-4 text-3xl">
            {["🧧", "🎁", "🧧", "🎊"].map((e, i) => (
              <span key={i} className="animate-bounce" style={{ animationDelay: `${i * 0.15}s` }}>
                {e}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="space-y-1">
        <p className="truncate text-sm font-semibold text-white/80">{title || "闭幕全场大抽奖"}</p>
        <p className="text-xs text-white/40">
          动效将在 BS9 控制台启动后同步至投影大屏
        </p>
      </div>
    </div>
  );
}
