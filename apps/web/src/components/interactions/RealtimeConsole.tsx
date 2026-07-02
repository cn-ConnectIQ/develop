"use client";

import { useEffect, useState } from "react";
import { Star } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { RealtimePollChart } from "@/components/interactions/charts/RealtimePollChart";
import {
  OpenBigscreenButton,
  PushToAttendeesButton,
} from "@/components/interactions/PushToAttendeesButton";
import { useRealtimePollResults } from "@/hooks/useRealtimePollResults";
import { patchPoll } from "@/hooks/useInteractionAutoSave";
import { cn } from "@/lib/utils";
import type { InteractionPollItem } from "@/lib/interaction-manager";

type RealtimeConsoleProps = {
  eventId: string;
  poll: InteractionPollItem;
  onPause: () => void;
  onStop: () => void;
  onExtend: () => void;
};

function formatCountdown(closesAt: string | null): string | null {
  if (!closesAt) return null;
  const diff = new Date(closesAt).getTime() - Date.now();
  if (diff <= 0) return "00:00";
  const mins = Math.floor(diff / 60000);
  const secs = Math.floor((diff % 60000) / 1000);
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export function RealtimeConsole({
  eventId,
  poll,
  onPause,
  onStop,
  onExtend,
}: RealtimeConsoleProps) {
  const { data, refetch } = useRealtimePollResults({
    eventId,
    pollId: poll.id,
    enabled: true,
  });

  const [countdown, setCountdown] = useState<string | null>(
    formatCountdown(poll.closesAt),
  );
  const [showResults, setShowResults] = useState(poll.showResults ?? true);
  const [lockVotes, setLockVotes] = useState(false);

  useEffect(() => {
    void (async () => {
      const res = await fetch(
        `/api/events/${eventId}/polls/${poll.id}/display`,
      );
      if (!res.ok) return;
      const json = await res.json();
      if (json.data?.lockVotes !== undefined) {
        setLockVotes(json.data.lockVotes);
      }
    })();
  }, [eventId, poll.id]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(formatCountdown(data?.closesAt ?? poll.closesAt));
    }, 1000);
    return () => clearInterval(timer);
  }, [data?.closesAt, poll.closesAt]);

  const total = data?.total ?? poll._count?.responses ?? 0;

  async function toggleShowResults(checked: boolean) {
    setShowResults(checked);
    await patchPoll(eventId, poll.id, { showResults: checked });
    void refetch();
  }

  async function toggleLockVotes(checked: boolean) {
    setLockVotes(checked);
    await fetch(`/api/events/${eventId}/polls/${poll.id}/display`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lockVotes: checked }),
    });
  }

  return (
    <div className="flex-1 overflow-y-auto px-6 py-5">
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-border-light bg-white p-4">
        <h2 className="min-w-0 flex-1 truncate text-sm font-semibold">
          {poll.title}
        </h2>
        <span className="animate-pulse rounded-full bg-brand-amber-light px-2 py-0.5 text-xs text-brand-amber">
          进行中
        </span>
        <div className="text-center">
          <span className="text-xl font-bold text-brand-blue">{total}</span>
          <span className="ml-1 text-xs text-text-muted">人参与</span>
        </div>
        {countdown && (
          <span className="font-mono text-xl font-bold text-brand-amber">
            {countdown}
          </span>
        )}
        <PushToAttendeesButton
          eventId={eventId}
          kind="poll"
          targetId={poll.id}
        />
        <OpenBigscreenButton eventId={eventId} />
        <button
          type="button"
          onClick={onPause}
          className="h-8 rounded-lg border border-brand-amber bg-brand-amber-light px-3 text-xs text-brand-amber"
        >
          暂停
        </button>
        <button
          type="button"
          onClick={onStop}
          className="h-8 rounded-lg border border-brand-red bg-brand-red-light px-3 text-xs text-brand-red"
        >
          结束
        </button>
        <button
          type="button"
          onClick={onExtend}
          className="cursor-pointer text-xs text-text-muted hover:text-brand-blue"
        >
          +2min
        </button>
      </div>

      <div className="rounded-xl border border-border-light bg-white p-4">
        {poll.type === "WORD_CLOUD" && data?.wordCloud?.length ? (
          <WordCloudTags items={data.wordCloud} />
        ) : poll.type === "RATING" ? (
          <RatingResults options={data?.options ?? []} total={total} />
        ) : (
          <RealtimePollChart options={data?.options ?? []} />
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border-light bg-white p-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-text-muted">显示结果给参会者</span>
          <Switch checked={showResults} onCheckedChange={toggleShowResults} />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-text-muted">锁定投票</span>
          <Switch checked={lockVotes} onCheckedChange={toggleLockVotes} />
        </div>
      </div>
    </div>
  );
}

function WordCloudTags({
  items,
}: {
  items: Array<{ text: string; count: number; weight?: number }>;
}) {
  const max = Math.max(...items.map((i) => i.count), 1);
  return (
    <div className="flex flex-wrap gap-2 py-4">
      {items.map((item) => {
        const size = 12 + (item.count / max) * 28;
        return (
          <span
            key={item.text}
            className="font-medium text-brand-blue"
            style={{ fontSize: size }}
          >
            {item.text}
          </span>
        );
      })}
    </div>
  );
}

function RatingResults({
  options,
  total,
}: {
  options: Array<{ count: number; text: string }>;
  total: number;
}) {
  const sum = options.reduce(
    (acc, o, i) => acc + (i + 1) * o.count,
    0,
  );
  const avg = total > 0 ? (sum / total).toFixed(1) : "—";

  return (
    <div className="py-6 text-center">
      <p className="text-4xl font-black text-brand-blue">{avg}</p>
      <div className="mt-3 flex justify-center gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <Star
            key={n}
            className={cn(
              "size-6",
              Number(avg) >= n
                ? "fill-brand-gold text-brand-gold"
                : "text-gray-300",
            )}
          />
        ))}
      </div>
    </div>
  );
}
