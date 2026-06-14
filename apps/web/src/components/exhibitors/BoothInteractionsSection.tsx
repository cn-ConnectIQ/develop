"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle,
  CheckSquare,
  Cloud,
  Gift,
  Plus,
  Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { CreateBoothInteractionSheet } from "@/components/exhibitors/CreateBoothInteractionSheet";
import { BoothInteractionControlSheet } from "@/components/exhibitors/BoothInteractionControlSheet";
import type { BoothInteractionItem } from "@/lib/exhibitor/booth-interaction-service";
import { POLL_TYPE_LABELS } from "@/lib/interactions";
import { cn } from "@/lib/utils";

const typeIcons: Record<string, typeof CheckCircle> = {
  SINGLE_CHOICE: CheckCircle,
  MULTI_CHOICE: CheckSquare,
  WORD_CLOUD: Cloud,
  RATING: Star,
  RANDOM: Gift,
};

const POLL_STATUS_LABELS: Record<string, string> = {
  DRAFT: "草稿",
  LIVE: "进行中",
  PAUSED: "已暂停",
  CLOSED: "已结束",
};

const LOTTERY_STATUS_LABELS: Record<string, string> = {
  DRAFT: "草稿",
  READY: "待开放",
  OPEN: "进行中",
  DRAWING: "抽奖中",
  FINISHED: "已结束",
};

function statusBadgeClass(status: string) {
  if (status === "LIVE" || status === "OPEN") {
    return "bg-brand-amber-light text-brand-amber";
  }
  if (status === "CLOSED" || status === "FINISHED") {
    return "bg-border-light text-text-muted";
  }
  return "bg-brand-blue-light text-brand-blue";
}

async function fetchBoothInteractions(boothId: string) {
  const res = await fetch(`/api/exhibitor/booths/${boothId}/interactions`);
  if (!res.ok) throw new Error("加载失败");
  return (await res.json()).data as BoothInteractionItem[];
}

export function BoothInteractionsSection({ boothId }: { boothId: string }) {
  const [createOpen, setCreateOpen] = useState(false);
  const [controlItem, setControlItem] = useState<BoothInteractionItem | null>(
    null,
  );
  const queryClient = useQueryClient();

  const { data: interactions = [], isLoading } = useQuery({
    queryKey: ["booth-interactions", boothId],
    queryFn: () => fetchBoothInteractions(boothId),
    refetchInterval: 15000,
  });

  function refresh() {
    void queryClient.invalidateQueries({
      queryKey: ["booth-interactions", boothId],
    });
  }

  return (
    <section className="mt-6">
      <h2 className="mb-3 font-semibold">我的互动</h2>

      {isLoading ? (
        <div className="rounded-xl border border-border-light bg-white p-8 text-center text-sm text-text-muted">
          加载中...
        </div>
      ) : (
        <div className="space-y-3">
          {interactions.map((item) => {
            const Icon = typeIcons[item.subType] ?? CheckCircle;
            const typeLabel =
              item.kind === "poll"
                ? (POLL_TYPE_LABELS[item.subType] ?? "投票")
                : "现场抽奖";
            const statusLabel =
              item.kind === "poll"
                ? (POLL_STATUS_LABELS[item.status] ?? item.status)
                : (LOTTERY_STATUS_LABELS[item.status] ?? item.status);

            return (
              <div
                key={item.id}
                className="flex items-center gap-3 rounded-xl border border-border-light bg-white p-4"
              >
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-amber-light">
                  <Icon className="size-5 text-brand-amber" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{item.title}</p>
                  <p className="text-sm text-text-muted">
                    {typeLabel} · {item.participantCount} 人参与
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-0.5 text-xs font-medium",
                      statusBadgeClass(item.status),
                    )}
                  >
                    {statusLabel}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 rounded-lg"
                    onClick={() => setControlItem(item)}
                  >
                    控制
                  </Button>
                </div>
              </div>
            );
          })}

          {interactions.length === 0 && (
            <div className="rounded-xl border border-dashed border-border-light bg-white p-8 text-center text-sm text-text-muted">
              暂无展位互动，点击下方按钮发起
            </div>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={() => setCreateOpen(true)}
        className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-brand-amber text-sm font-medium text-white transition-colors hover:bg-brand-amber/90"
      >
        <Plus className="size-4" />
        发起展位互动
      </button>

      <CreateBoothInteractionSheet
        boothId={boothId}
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSuccess={refresh}
      />

      <BoothInteractionControlSheet
        interaction={controlItem}
        open={!!controlItem}
        onOpenChange={(open) => {
          if (!open) setControlItem(null);
        }}
        onUpdated={refresh}
      />
    </section>
  );
}
