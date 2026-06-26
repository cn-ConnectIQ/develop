"use client";

import { useState } from "react";
import Link from "next/link";
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
import {
  ListSectionHeader,
  ResourceListCard,
} from "@/components/admin/list-panel";
import { CreateBoothInteractionSheet } from "@/components/exhibitors/CreateBoothInteractionSheet";
import { BoothInteractionControlSheet } from "@/components/exhibitors/BoothInteractionControlSheet";
import type { BoothInteractionItem } from "@/lib/exhibitor/booth-interaction-types";
import { POLL_TYPE_LABELS, POLL_TYPE_BADGE } from "@/lib/interactions";

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

function statusVariant(
  status: string,
): "live" | "draft" | "ended" | "default" {
  if (status === "LIVE" || status === "OPEN") return "live";
  if (status === "CLOSED" || status === "FINISHED") return "ended";
  if (status === "DRAFT" || status === "READY") return "draft";
  return "default";
}

async function fetchBoothInteractions(boothId: string) {
  const res = await fetch(`/api/booths/${boothId}/interactions`);
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
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-semibold">我的互动</h2>
        <Link
          href={`/exhibitor/booths/${boothId}/interactions`}
          className="text-sm text-brand-amber hover:underline"
        >
          管理全部 →
        </Link>
      </div>

      {isLoading ? (
        <div className="rounded-xl border border-border-light bg-white p-8 text-center text-sm text-text-muted">
          加载中...
        </div>
      ) : (
        <div className="space-y-2">
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
            const iconTone =
              item.kind === "lottery"
                ? "bg-violet-50 text-violet-600"
                : (POLL_TYPE_BADGE[item.subType] ?? "bg-gray-100 text-text-muted");

            return (
              <ResourceListCard
                key={item.id}
                icon={<Icon className="size-4" />}
                iconContainerClassName={iconTone}
                title={item.title}
                subtitle={`${typeLabel} · ${item.participantCount} 人参与`}
                status={{
                  label: statusLabel,
                  variant: statusVariant(item.status),
                }}
                footer={
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 rounded-lg"
                    onClick={() => setControlItem(item)}
                  >
                    控制
                  </Button>
                }
              />
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
        boothId={boothId}
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
