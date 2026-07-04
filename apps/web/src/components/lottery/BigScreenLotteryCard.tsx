"use client";

import Link from "next/link";
import { ArrowRight, Trash2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { StatusChip } from "@/components/ui/status-chip";
import type { OrganizerLotteryDto } from "@/lib/lottery/organizer-lottery-config";
import {
  formatEligibilitySummary,
  formatPoolCount,
  formatTierPreview,
  getBigScreenLifecycleStatus,
  getDrawStatusLabel,
  getDrawStatusVariant,
} from "@/lib/lottery/big-screen-lottery-utils";
import { cn } from "@/lib/utils";

type BigScreenLotteryCardProps = {
  eventId: string;
  lottery: OrganizerLotteryDto;
  onDelete?: (lotteryId: string) => void;
  deleting?: boolean;
};

function StatusDot({ status }: { status: string }) {
  const lifecycle = getBigScreenLifecycleStatus(status);

  if (lifecycle === "active") {
    return (
      <span
        className="mt-1.5 size-2.5 shrink-0 rounded-full bg-brand-green"
        aria-hidden
      />
    );
  }

  if (lifecycle === "ended") {
    return (
      <span
        className="mt-1.5 size-2.5 shrink-0 rounded-full bg-text-tertiary/40"
        aria-hidden
      />
    );
  }

  return (
    <span
      className="mt-1.5 size-2.5 shrink-0 rounded-full border-2 border-text-tertiary/50 bg-transparent"
      aria-hidden
    />
  );
}

export function BigScreenLotteryCard({
  eventId,
  lottery,
  onDelete,
  deleting = false,
}: BigScreenLotteryCardProps) {
  const lifecycle = getBigScreenLifecycleStatus(lottery.status);
  const tierPreview = formatTierPreview(lottery);
  const eligibilitySummary = formatEligibilitySummary(lottery);
  const drawStatusLabel = getDrawStatusLabel(lottery.status);
  const drawStatusVariant = getDrawStatusVariant(lottery.status);

  const configHref = `/events/${eventId}/lottery/big-screen/${lottery.id}`;
  const consoleHref = `/events/${eventId}/screen/lottery?lottery=${lottery.id}`;
  const verifyHref = `/events/${eventId}/verify`;

  return (
    <article
      className={cn(
        "flex flex-col gap-4 rounded-lg border border-border bg-surface p-5 shadow-sm transition-shadow",
        "hover:shadow-md sm:flex-row sm:items-center",
      )}
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <StatusDot status={lottery.status} />

        <div className="min-w-0 flex-1 space-y-2">
          <h3 className="truncate text-lg font-semibold text-text-primary">
            {lottery.title}
          </h3>

          <div className="flex flex-wrap gap-1.5">
            {tierPreview.map((item) => (
              <span
                key={item.key}
                className="inline-flex items-center rounded-sm bg-surface-secondary px-2 py-0.5 text-xs text-text-secondary"
              >
                {item.label}
              </span>
            ))}
          </div>

          <p className="text-sm text-text-secondary">{eligibilitySummary}</p>
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-4 sm:justify-end">
        <div className="text-right">
          <p className="text-xl font-bold tabular-nums text-brand-green">
            {formatPoolCount(lottery.entry_count)}
          </p>
          <p className="text-xs text-text-secondary">人已加入</p>
          <div className="mt-2">
            <StatusChip variant={drawStatusVariant}>
              {drawStatusLabel}
            </StatusChip>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {lifecycle === "draft" && (
            <>
              <Link
                href={configHref}
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                继续配置
              </Link>
              <Button
                variant="destructive"
                size="sm"
                disabled={deleting}
                onClick={() => onDelete?.(lottery.id)}
              >
                <Trash2 className="size-3.5" />
                删除
              </Button>
            </>
          )}

          {(lifecycle === "active") && (
            <>
              <Link
                href={configHref}
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                查看详情
              </Link>
              <Link
                href={consoleHref}
                className={buttonVariants({ variant: "default", size: "sm" })}
              >
                进入控制台
                <ArrowRight data-icon="inline-end" />
              </Link>
            </>
          )}

          {lifecycle === "ended" && (
            <>
              <Link
                href={consoleHref}
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                查看结果
              </Link>
              <Link
                href={verifyHref}
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                查看核销情况
              </Link>
            </>
          )}
        </div>
      </div>
    </article>
  );
}
