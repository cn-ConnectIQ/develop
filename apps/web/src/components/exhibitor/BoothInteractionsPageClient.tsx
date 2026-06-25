"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Monitor, Plus, X } from "lucide-react";
import { toast } from "sonner";
import {
  AdminContent,
  AdminHeader,
  AdminPage,
} from "@/components/admin/admin-header";
import { Button } from "@/components/ui/button";
import { BoothInteractionSheet } from "@/components/exhibitor/BoothInteractionSheet";
import {
  BoothInteractionResults,
  BoothInteractionTypeIcon,
} from "@/components/exhibitor/BoothInteractionResults";
import { InteractionQRDisplay } from "@/components/interactions/InteractionQRDisplay";
import {
  boothInteractionGroupStatus,
  type BoothInteractionItem,
} from "@/lib/exhibitor/booth-interaction-types";
import { POLL_TYPE_LABELS } from "@/lib/interactions";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const POLL_STATUS: Record<string, string> = {
  DRAFT: "草稿",
  LIVE: "进行中",
  PAUSED: "已暂停",
  CLOSED: "已结束",
};

const LOTTERY_STATUS: Record<string, string> = {
  DRAFT: "草稿",
  READY: "待开放",
  OPEN: "进行中",
  DRAWING: "抽奖中",
  FINISHED: "已结束",
};

async function fetchInteractions(boothId: string) {
  const res = await fetch(`/api/booths/${boothId}/interactions`);
  if (!res.ok) throw new Error("加载失败");
  return (await res.json()).data as BoothInteractionItem[];
}

type BoothInteractionsPageClientProps = {
  boothId: string;
  boothCode: string;
  eventName: string;
};

export function BoothInteractionsPageClient({
  boothId,
  boothCode,
  eventName,
}: BoothInteractionsPageClientProps) {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [showIntro, setShowIntro] = useState(true);
  const [detailItem, setDetailItem] = useState<BoothInteractionItem | null>(
    null,
  );
  const [drawing, setDrawing] = useState(false);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["booth-interactions", boothId],
    queryFn: () => fetchInteractions(boothId),
    refetchInterval: 15000,
  });

  const grouped = useMemo(() => {
    const live: BoothInteractionItem[] = [];
    const draft: BoothInteractionItem[] = [];
    const ended: BoothInteractionItem[] = [];
    for (const item of items) {
      const g = boothInteractionGroupStatus(item.kind, item.status);
      if (g === "live") live.push(item);
      else if (g === "ended") ended.push(item);
      else draft.push(item);
    }
    return { live, draft, ended };
  }, [items]);

  function refresh() {
    void queryClient.invalidateQueries({
      queryKey: ["booth-interactions", boothId],
    });
  }

  async function patchInteraction(
    sessionId: string,
    body: Record<string, unknown>,
  ) {
    const res = await fetch(
      `/api/booths/${boothId}/interactions/${sessionId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );
    if (!res.ok) {
      toast.error("操作失败");
      return false;
    }
    refresh();
    return true;
  }

  const drawMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      setDrawing(true);
      const res = await fetch(
        `/api/booths/${boothId}/interactions/${sessionId}/draw`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prize_rank: 1, count: 1 }),
        },
      );
      if (!res.ok) throw new Error("开奖失败");
    },
    onSuccess: () => {
      toast.success("开奖完成");
      refresh();
    },
    onError: () => toast.error("开奖失败"),
    onSettled: () => setDrawing(false),
  });

  return (
    <AdminPage>
      <AdminHeader
        title={`${boothCode} 展位互动`}
        description={eventName}
        breadcrumb={["展位互动", boothCode]}
        actions={
          <Button
            className="bg-brand-amber text-white hover:bg-brand-amber/90"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="mr-1 size-4" />
            发起互动
          </Button>
        }
      />
      <AdminContent>
        {showIntro && (
          <div className="relative mb-6 rounded-xl border border-brand-amber/30 bg-brand-amber-light/40 p-5">
            <button
              type="button"
              className="absolute top-3 right-3 text-text-muted hover:text-text-primary"
              onClick={() => setShowIntro(false)}
              aria-label="关闭说明"
            >
              <X className="size-4" />
            </button>
            <p className="font-medium text-brand-amber">
              在你的展位发起互动，吸引参会者停留和参与
            </p>
            <ul className="mt-3 grid gap-2 text-sm text-text-muted sm:grid-cols-3">
              <li>投票 — 快速收集意见</li>
              <li>问答 — 收集参会者提问</li>
              <li>抽奖 — 聚集人气，可选留资获客</li>
            </ul>
          </div>
        )}

        {isLoading ? (
          <p className="py-16 text-center text-sm text-text-muted">加载中…</p>
        ) : items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border-light py-16 text-center">
            <p className="text-sm text-text-muted">暂无展位互动</p>
            <Button
              className="mt-4 bg-brand-amber text-white hover:bg-brand-amber/90"
              onClick={() => setCreateOpen(true)}
            >
              发起第一个互动
            </Button>
          </div>
        ) : (
          <div className="space-y-8">
            <InteractionGroup
              title="进行中"
              dotClass="bg-brand-green"
              items={grouped.live}
              onDetail={setDetailItem}
              onPatch={patchInteraction}
            />
            <InteractionGroup
              title="草稿"
              items={grouped.draft}
              onDetail={setDetailItem}
              onPatch={patchInteraction}
            />
            <InteractionGroup
              title="已结束"
              items={grouped.ended}
              onDetail={setDetailItem}
              onPatch={patchInteraction}
            />
          </div>
        )}

        <p className="mt-6 text-center text-sm">
          <Link
            href={`/exhibitor/booths/${boothId}`}
            className="text-brand-amber hover:underline"
          >
            ← 返回展位看板
          </Link>
        </p>
      </AdminContent>

      <BoothInteractionSheet
        boothId={boothId}
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSuccess={refresh}
      />

      <Sheet open={!!detailItem} onOpenChange={(o) => !o && setDetailItem(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-[560px]">
          {detailItem && (
            <>
              <SheetHeader>
                <SheetTitle>{detailItem.title}</SheetTitle>
              </SheetHeader>
              <div className="mt-4 space-y-6">
                {detailItem.qrUrl && (
                  <InteractionQRDisplay
                    sessionCode={detailItem.sessionCode}
                    qrUrl={detailItem.qrUrl}
                    interactionTitle={detailItem.title}
                    className="border-0 p-0 shadow-none"
                  />
                )}
                <a
                  href={detailItem.scanUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-9 items-center rounded-lg border border-border-light px-3 text-sm text-brand-blue"
                >
                  <Monitor className="mr-1 size-4" />
                  大屏展示
                </a>
                <BoothInteractionResults
                  boothId={boothId}
                  sessionId={detailItem.id}
                  drawing={drawing}
                  onDraw={
                    detailItem.kind === "lottery"
                      ? () => drawMutation.mutate(detailItem.id)
                      : undefined
                  }
                />
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </AdminPage>
  );
}

function InteractionGroup({
  title,
  dotClass,
  items,
  onDetail,
  onPatch,
}: {
  title: string;
  dotClass?: string;
  items: BoothInteractionItem[];
  onDetail: (item: BoothInteractionItem) => void;
  onPatch: (id: string, body: Record<string, unknown>) => Promise<boolean>;
}) {
  if (items.length === 0) return null;

  return (
    <section>
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
        {dotClass && (
          <span className={cn("size-2 rounded-full", dotClass)} aria-hidden />
        )}
        {title}
        <span className="text-text-muted">（{items.length}）</span>
      </h2>
      <div className="space-y-3">
        {items.map((item) => (
          <InteractionCard
            key={item.id}
            item={item}
            onDetail={() => onDetail(item)}
            onPatch={onPatch}
          />
        ))}
      </div>
    </section>
  );
}

function InteractionCard({
  item,
  onDetail,
  onPatch,
}: {
  item: BoothInteractionItem;
  onDetail: () => void;
  onPatch: (id: string, body: Record<string, unknown>) => Promise<boolean>;
}) {
  const typeLabel =
    item.kind === "poll"
      ? (POLL_TYPE_LABELS[item.subType] ?? "投票")
      : "展位抽奖";
  const statusLabel =
    item.kind === "poll"
      ? (POLL_STATUS[item.status] ?? item.status)
      : (LOTTERY_STATUS[item.status] ?? item.status);
  const isLive = item.status === "LIVE" || item.status === "OPEN";

  return (
    <div className="rounded-xl border border-border-light bg-white p-4">
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-amber-light">
          <BoothInteractionTypeIcon
            subType={item.subType}
            kind={item.kind}
            className="text-brand-amber"
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{item.title}</p>
          <p className="mt-1 text-sm text-text-muted">
            {typeLabel} · {item.participantCount} 人参与
            {item.requireLeadCapture ? " · 留资开启" : ""}
          </p>
          <span
            className={cn(
              "mt-2 inline-block rounded-full px-2 py-0.5 text-xs font-medium",
              isLive
                ? "bg-brand-green-light text-brand-green"
                : "bg-border-light text-text-muted",
            )}
          >
            {statusLabel}
          </span>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={onDetail}>
          数据 / 二维码
        </Button>
        {item.status === "DRAFT" && (
          <Button
            size="sm"
            className="bg-brand-amber text-white hover:bg-brand-amber/90"
            onClick={() => void onPatch(item.id, { publish: true })}
          >
            上线
          </Button>
        )}
        {isLive && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => void onPatch(item.id, { close: true })}
          >
            结束
          </Button>
        )}
      </div>
    </div>
  );
}
