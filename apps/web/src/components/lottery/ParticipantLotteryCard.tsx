"use client";

import { useState } from "react";
import Link from "next/link";
import { Monitor, QrCode } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { StatusChip } from "@/components/ui/status-chip";
import { ParticipantLotteryJoinQrDialog } from "@/components/lottery/ParticipantLotteryJoinQrDialog";
import type { ParticipantLotteryListItem } from "@/lib/interaction/lottery-service";
import {
  buildParticipantDashboardPath,
  canPauseParticipantLottery,
  canResumeParticipantLottery,
  formatBoothChipName,
  formatParticipantCount,
  getAnimationBadge,
  getParticipantDisplayStatus,
  getParticipantLifecycleStatus,
  getParticipantTypeEmoji,
} from "@/lib/lottery/participant-lottery-utils";
import { withPublicPath } from "@/lib/public-path";
import { cn } from "@/lib/utils";

type ParticipantLotteryCardProps = {
  eventId: string;
  lottery: ParticipantLotteryListItem;
  onTogglePause?: (lotteryId: string, nextStatus: "ACTIVE" | "DRAFT") => void;
  onReplenish?: (lotteryId: string, quantity: number) => Promise<void>;
  toggling?: boolean;
  replenishing?: boolean;
};

function StatusDot({ lottery }: { lottery: ParticipantLotteryListItem }) {
  const lifecycle = getParticipantLifecycleStatus(lottery);

  if (lifecycle === "active" && !lottery.is_stock_depleted) {
    return (
      <span
        className="mt-1 size-2.5 shrink-0 rounded-full bg-brand-green"
        aria-hidden
      />
    );
  }

  if (lifecycle === "ended") {
    return (
      <span
        className="mt-1 size-2.5 shrink-0 rounded-full bg-text-tertiary/40"
        aria-hidden
      />
    );
  }

  return (
    <span
      className="mt-1 size-2.5 shrink-0 rounded-full border-2 border-text-tertiary/50 bg-transparent"
      aria-hidden
    />
  );
}

function PrizePreview({ lottery }: { lottery: ParticipantLotteryListItem }) {
  if (lottery.lottery_category === "INSTANT_CLAIM") {
    const prize = lottery.prizes[0];
    if (!prize) {
      return (
        <p className="text-sm text-text-secondary">单一奖品 · 库存未配置</p>
      );
    }
    return (
      <span className="inline-flex items-center rounded-sm bg-surface-secondary px-2 py-0.5 text-xs text-text-secondary">
        🎁 {prize.name} · 剩余 {prize.remaining}/{prize.quantity}
      </span>
    );
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {lottery.prizes.map((prize) => (
        <span
          key={prize.id ?? prize.name}
          className="inline-flex items-center rounded-sm bg-surface-secondary px-2 py-0.5 text-xs text-text-secondary"
        >
          {prize.name}
          {prize.probability_percent != null
            ? ` · ${prize.probability_percent}%`
            : ""}
          {prize.remaining <= 0 ? " · 已罄" : ""}
        </span>
      ))}
    </div>
  );
}

export function ParticipantLotteryCard({
  eventId,
  lottery,
  onTogglePause,
  onReplenish,
  toggling = false,
  replenishing = false,
}: ParticipantLotteryCardProps) {
  const [replenishOpen, setReplenishOpen] = useState(false);
  const [joinQrOpen, setJoinQrOpen] = useState(false);
  const [addQuantity, setAddQuantity] = useState("50");

  const dashboardPath = buildParticipantDashboardPath(eventId, lottery);
  const displayStatus = getParticipantDisplayStatus(lottery);
  const animationBadge = getAnimationBadge(lottery.animation_type);
  const typeEmoji = getParticipantTypeEmoji(lottery.lottery_category);
  const isOrganizerLottery =
    lottery.owner_type === "ORGANIZER" && !lottery.booth;
  const lifecycle = getParticipantLifecycleStatus(lottery);
  const showOrganizerLiveActions =
    isOrganizerLottery && lifecycle === "active";

  function openBigScreen() {
    window.open(
      withPublicPath(
        `/events/${eventId}/interactions/bigscreen?mode=lottery&lottery=${lottery.id}`,
      ),
      "_blank",
    );
  }

  async function handleReplenish() {
    const quantity = Number.parseInt(addQuantity, 10);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      toast.error("请输入有效数量");
      return;
    }
    try {
      await onReplenish?.(lottery.id, quantity);
      setReplenishOpen(false);
      toast.success("库存已补充");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "补充失败");
    }
  }

  return (
    <>
      <article
        className={cn(
          "flex flex-col gap-4 rounded-lg border border-border bg-surface p-5 shadow-sm transition-shadow",
          "hover:shadow-md lg:flex-row lg:items-center",
        )}
      >
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <div className="flex shrink-0 flex-col items-center gap-1">
            <span className="text-xl" aria-hidden>
              {typeEmoji}
            </span>
            <StatusDot lottery={lottery} />
          </div>

          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-lg font-semibold text-text-primary">
                {lottery.title}
              </h3>
              {lottery.booth || lottery.owner_type === "ORGANIZER" ? (
                <span
                  className={cn(
                    "inline-flex rounded-sm px-2 py-0.5 text-xs font-medium",
                    lottery.owner_type === "ORGANIZER"
                      ? "bg-brand-green-light text-brand-green"
                      : "bg-brand-blue-light text-brand-blue",
                  )}
                >
                  {formatBoothChipName(lottery)}
                </span>
              ) : null}
            </div>

            <PrizePreview lottery={lottery} />

            {lottery.lottery_category === "AUTO_PROBABILITY" &&
              animationBadge && (
                <p className="text-xs text-text-secondary">
                  {animationBadge.emoji} {animationBadge.title}
                </p>
              )}
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-4 lg:justify-end">
          <div className="text-right">
            <p className="text-xl font-bold tabular-nums text-text-primary">
              {formatParticipantCount(lottery.today_entry_count)}
            </p>
            <p className="text-xs text-text-secondary">今日参与</p>
            <div className="mt-2">
              <StatusChip variant={displayStatus.variant}>
                {displayStatus.label}
              </StatusChip>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {dashboardPath ? (
              <>
                <Link
                  href={dashboardPath}
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  查看数据
                </Link>
                <Link
                  href={dashboardPath}
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  编辑
                </Link>
              </>
            ) : (
              <span className="text-xs text-text-secondary">暂无管理入口</span>
            )}

            {showOrganizerLiveActions ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openBigScreen()}
                >
                  <Monitor className="size-3.5" />
                  大屏
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setJoinQrOpen(true)}
                >
                  <QrCode className="size-3.5" />
                  获取扫码
                </Button>
              </>
            ) : null}

            {canPauseParticipantLottery(lottery) && (
              <Button
                variant="outline"
                size="sm"
                disabled={toggling}
                onClick={() => onTogglePause?.(lottery.id, "DRAFT")}
              >
                暂停
              </Button>
            )}

            {canResumeParticipantLottery(lottery) && (
              <Button
                variant="outline"
                size="sm"
                disabled={toggling}
                onClick={() => onTogglePause?.(lottery.id, "ACTIVE")}
              >
                恢复
              </Button>
            )}

            {lottery.is_stock_depleted && (
              <Button
                size="sm"
                className="bg-brand-amber text-white hover:bg-brand-amber/90"
                disabled={replenishing}
                onClick={() => setReplenishOpen(true)}
              >
                补充库存
              </Button>
            )}
          </div>
        </div>
      </article>

      <Dialog open={replenishOpen} onOpenChange={setReplenishOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>补充库存</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-text-secondary">
            为「{lottery.title}」增加奖品库存，补充后将自动恢复进行中状态。
          </p>
          <Input
            type="number"
            min={1}
            value={addQuantity}
            onChange={(event) => setAddQuantity(event.target.value)}
            placeholder="补充数量"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setReplenishOpen(false)}>
              取消
            </Button>
            <Button
              className="bg-brand-amber text-white hover:bg-brand-amber/90"
              disabled={replenishing}
              onClick={() => void handleReplenish()}
            >
              确认补充
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ParticipantLotteryJoinQrDialog
        open={joinQrOpen}
        onOpenChange={setJoinQrOpen}
        eventId={eventId}
        lotteryId={lottery.id}
        title={lottery.title}
      />
    </>
  );
}
