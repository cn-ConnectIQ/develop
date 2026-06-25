"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type RecommendedBuyer = {
  buyer_user_id: string;
  name: string;
  company: string | null;
  job_title: string | null;
  intent_level: "A" | "B" | "C";
  recommend_reason: string;
  occurred_at: string;
  pending_contact: boolean;
};

function formatMinutesAgo(iso: string) {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "刚刚在你展位附近";
  if (minutes < 60) return `${minutes} 分钟前在你展位附近`;
  const hours = Math.floor(minutes / 60);
  return `${hours} 小时前在你展位附近`;
}

function intentBadge(level: "A" | "B" | "C") {
  const styles = {
    A: "bg-brand-red-light text-brand-red",
    B: "bg-brand-blue-light text-brand-blue",
    C: "bg-border-light text-text-muted",
  };
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[10px] font-semibold",
        styles[level],
      )}
    >
      {level} 级
    </span>
  );
}

type RecommendedBuyerCardProps = {
  buyer: RecommendedBuyer;
  eventId: string;
  boothId: string;
};

export function RecommendedBuyerCard({
  buyer,
  eventId,
  boothId,
}: RecommendedBuyerCardProps) {
  const [connecting, setConnecting] = useState(false);

  async function handleConnect() {
    setConnecting(true);
    try {
      const res = await fetch("/api/connections/exchange-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target_user_id: buyer.buyer_user_id,
          event_id: eventId,
          booth_id: boothId,
          from_ai_match: true,
          message: buyer.recommend_reason,
        }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error?.message ?? json.error ?? "发送失败");
      }
      toast.success("连接邀请已发送");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "发送失败");
    } finally {
      setConnecting(false);
    }
  }

  const subtitle = [buyer.company, buyer.job_title].filter(Boolean).join(" · ");

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border-light bg-white p-4 sm:flex-row sm:items-start">
      <Avatar className="size-11 shrink-0">
        <AvatarFallback className="bg-brand-purple-light text-brand-purple">
          {buyer.name.slice(0, 1)}
        </AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-semibold">{buyer.name}</p>
          {intentBadge(buyer.intent_level)}
          {buyer.pending_contact && (
            <span className="rounded-full bg-brand-amber-light px-2 py-0.5 text-[10px] font-medium text-brand-amber">
              待联系
            </span>
          )}
        </div>
        {subtitle && (
          <p className="mt-0.5 text-sm text-text-muted">{subtitle}</p>
        )}
        <p className="mt-2 text-sm text-brand-purple">{buyer.recommend_reason}</p>
        <p className="mt-1 text-xs text-text-muted">
          {formatMinutesAgo(buyer.occurred_at)}
        </p>
      </div>

      <div className="flex shrink-0 flex-wrap gap-2 sm:flex-col">
        <Button
          size="sm"
          className="bg-brand-blue hover:bg-brand-blue/90"
          disabled={connecting}
          onClick={() => void handleConnect()}
        >
          发起连接邀请
        </Button>
        <Link
          href={`/users/${buyer.buyer_user_id}`}
          className="inline-flex h-8 items-center justify-center rounded-md border border-border-light px-3 text-sm font-medium hover:bg-gray-50"
        >
          查看名片
        </Link>
      </div>
    </div>
  );
}
