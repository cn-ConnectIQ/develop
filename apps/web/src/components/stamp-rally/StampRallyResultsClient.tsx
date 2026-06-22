"use client";

import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AdminContent,
  AdminHeader,
  AdminPage,
} from "@/components/admin/admin-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ApiStampRallyWinner } from "@/lib/stamp-rally-service";
import { cn } from "@/lib/utils";

async function fetchWinners(eventId: string, rallyId: string) {
  const res = await fetch(
    `/api/events/${eventId}/stamp-rallies/${rallyId}/winners`,
  );
  if (!res.ok) throw new Error("加载失败");
  return (await res.json()).data.winners as ApiStampRallyWinner[];
}

export function StampRallyResultsClient({
  eventId,
  rallyId,
  rallyName,
}: {
  eventId: string;
  rallyId: string;
  rallyName: string;
}) {
  const queryClient = useQueryClient();

  const { data: winners = [], isLoading } = useQuery({
    queryKey: ["stamp-rally-winners", eventId, rallyId],
    queryFn: () => fetchWinners(eventId, rallyId),
  });

  async function toggleRedeemed(winner: ApiStampRallyWinner) {
    const res = await fetch(
      `/api/events/${eventId}/stamp-rallies/${rallyId}/winners`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          winner_id: winner.id,
          redeemed: !winner.redeemed,
        }),
      },
    );
    if (!res.ok) {
      toast.error("更新失败");
      return;
    }
    toast.success(winner.redeemed ? "已标记未兑换" : "已标记已兑换");
    void queryClient.invalidateQueries({
      queryKey: ["stamp-rally-winners", eventId, rallyId],
    });
  }

  return (
    <AdminPage>
      <AdminHeader
        title={`集章结果 · ${rallyName}`}
        breadcrumb={["集章打卡", "完成名单"]}
        actions={
          <Link
            href={`/events/${eventId}/stamp-rally`}
            className="inline-flex h-8 items-center rounded-md border border-border-light bg-white px-3 text-sm font-medium hover:bg-gray-50"
          >
            返回配置
          </Link>
        }
      />

      <AdminContent>
        {isLoading && (
          <p className="py-12 text-center text-sm text-text-muted">加载中…</p>
        )}

        {!isLoading && winners.length === 0 && (
          <div className="rounded-xl border border-border-light bg-white py-16 text-center text-text-muted">
            暂无完成用户
          </div>
        )}

        <div className="space-y-3">
          {winners.map((winner) => (
            <div
              key={winner.id}
              className="flex flex-wrap items-center gap-4 rounded-xl border border-border-light bg-white p-4"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold">{winner.user_name}</p>
                  <Badge
                    className={cn(
                      "font-normal",
                      winner.redeemed
                        ? "bg-brand-green-light text-brand-green"
                        : "bg-brand-amber-light text-brand-amber",
                    )}
                  >
                    {winner.redeemed ? "已兑换" : "待兑换"}
                  </Badge>
                </div>
                <p className="mt-0.5 text-sm text-text-muted">
                  {winner.user_company ?? "—"}
                </p>
                <p className="mt-1 text-xs text-text-tertiary">
                  完成于 {new Date(winner.completed_at).toLocaleString("zh-CN")} ·{" "}
                  {winner.stamp_count} 个章
                </p>
              </div>
              <div className="flex gap-2">
                <Link
                  href={`/users/${winner.user_id}`}
                  className="inline-flex h-8 items-center rounded-md border border-border-light bg-white px-3 text-xs font-medium hover:bg-gray-50"
                >
                  查看名片
                </Link>
                <Button
                  size="sm"
                  className="bg-brand-blue text-white hover:bg-brand-blue/90"
                  onClick={() => void toggleRedeemed(winner)}
                >
                  {winner.redeemed ? "撤销兑换" : "标记已兑换"}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </AdminContent>
    </AdminPage>
  );
}
