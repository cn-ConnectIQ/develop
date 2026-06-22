"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import { Bot, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

type ScanStatus = {
  lastScan: {
    scanned_at: string;
    pairs_found: number;
    feeds_created: number;
  } | null;
};

async function fetchScanStatus(eventId: string): Promise<ScanStatus> {
  const res = await fetch(`/api/events/${eventId}/ai/scan-referrals`);
  if (!res.ok) throw new Error("加载扫描记录失败");
  return (await res.json()).data;
}

async function triggerScan(eventId: string) {
  const res = await fetch(`/api/events/${eventId}/ai/scan-referrals`, {
    method: "POST",
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "扫描失败");
  return json.data as { opportunitiesFound: number; feedsCreated: number };
}

export function AiReferralScanCard({ eventId }: { eventId: string }) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["ai-referral-scan", eventId],
    queryFn: () => fetchScanStatus(eventId),
  });

  const mutation = useMutation({
    mutationFn: () => triggerScan(eventId),
    onSuccess: (result) => {
      toast.success(
        `扫描完成：发现 ${result.opportunitiesFound} 对机会，推送 ${result.feedsCreated} 条 Feed`,
      );
      void queryClient.invalidateQueries({ queryKey: ["ai-referral-scan", eventId] });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "扫描失败");
    },
  });

  const last = data?.lastScan;

  return (
    <div className="rounded-xl border border-brand-purple bg-brand-purple-light p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="mb-2 flex items-center gap-2">
            <Bot className="size-5 shrink-0 text-brand-purple" />
            <h3 className="text-base font-semibold text-brand-purple">
              AI 引荐自动检测
            </h3>
          </div>
          <p className="text-sm text-text-muted">
            {isLoading
              ? "加载扫描记录..."
              : last
                ? `上次扫描：${format(new Date(last.scanned_at), "M月d日 HH:mm", { locale: zhCN })} · 发现 ${last.pairs_found} 对机会 · 推送了 ${last.feeds_created} 条 Feed`
                : "尚未执行过扫描 · 系统将在签到达 50 人或活动开始 2 小时后自动触发"}
          </p>
        </div>
        <Button
          className="h-9 bg-brand-purple px-4 text-white hover:bg-brand-purple/90"
          disabled={mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              扫描中...
            </>
          ) : (
            "立即扫描"
          )}
        </Button>
      </div>
    </div>
  );
}
