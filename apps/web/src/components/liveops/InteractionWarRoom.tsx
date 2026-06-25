"use client";

import Link from "next/link";
import { Gift, MessageSquare, Monitor, Plus } from "lucide-react";
import type { LiveOpsInteractionItem } from "@/lib/live-ops-types";
import { cn } from "@/lib/utils";

type InteractionWarRoomProps = {
  eventId: string;
  interactions: LiveOpsInteractionItem[];
};

const kindLabel: Record<string, string> = {
  SINGLE_CHOICE: "单选投票",
  MULTI_CHOICE: "多选投票",
  RATING: "评分",
  QNA: "问答",
  WORD_CLOUD: "词云",
  RANDOM: "抽奖",
};

export function InteractionWarRoom({
  eventId,
  interactions,
}: InteractionWarRoomProps) {
  return (
    <section className="rounded-xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold text-white">现场互动</h2>
        <Link
          href={`/events/${eventId}/interactions`}
          className="inline-flex h-8 items-center rounded-md bg-brand-blue px-3 text-sm font-medium text-white hover:bg-brand-blue/90"
        >
          <Plus className="mr-1 size-4" />
          快速发起
        </Link>
      </div>

      <div className="mt-4 space-y-3">
        {interactions.length === 0 ? (
          <div className="rounded-lg border border-dashed border-white/15 py-10 text-center">
            <MessageSquare className="mx-auto size-8 text-white/20" />
            <p className="mt-3 text-sm text-white/50">
              发起一个互动活跃现场
            </p>
            <Link
              href={`/events/${eventId}/interactions`}
              className="mt-2 inline-block text-sm text-brand-blue hover:underline"
            >
              前往互动管理 →
            </Link>
          </div>
        ) : (
          interactions.map((item) => {
            const Icon = item.kind === "lottery" ? Gift : MessageSquare;
            return (
              <div
                key={item.session_id}
                className="flex flex-wrap items-center gap-3 rounded-lg border border-white/10 bg-white/5 p-4"
              >
                <div
                  className={cn(
                    "flex size-10 shrink-0 items-center justify-center rounded-full",
                    item.owner_type === "EXHIBITOR"
                      ? "bg-brand-amber/20 text-brand-amber"
                      : "bg-brand-blue/20 text-brand-blue",
                  )}
                >
                  <Icon className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-white">{item.title}</p>
                  <p className="text-xs text-white/50">
                    {kindLabel[item.sub_type] ?? item.sub_type} · {item.owner_label}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1 text-sm font-semibold text-brand-green">
                    <span className="size-2 animate-pulse rounded-full bg-brand-green" />
                    {item.participant_count}
                  </span>
                  <Link
                    href={`/events/${eventId}/interactions/bigscreen?tab=${item.kind === "lottery" ? "lottery" : "poll"}`}
                    target="_blank"
                    className="inline-flex h-8 items-center gap-1 rounded-md border border-white/15 px-2.5 text-xs text-white hover:bg-white/10"
                  >
                    <Monitor className="size-3.5" />
                    上大屏
                  </Link>
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
