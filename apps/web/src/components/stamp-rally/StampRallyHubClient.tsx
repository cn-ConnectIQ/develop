"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BarChart3, Trophy } from "lucide-react";
import { toast } from "sonner";
import {
  AdminContent,
  AdminHeader,
  AdminPage,
} from "@/components/admin/admin-header";
import { StampMonitorPanel } from "@/components/expo/StampMonitorPanel";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import type { ApiStampRally } from "@/lib/stamp-rally-service";
import { cn } from "@/lib/utils";

const STATUS_LABEL: Record<string, { label: string; className: string }> = {
  DRAFT: { label: "草稿", className: "bg-brand-amber-light text-brand-amber" },
  ACTIVE: { label: "进行中", className: "bg-brand-green-light text-brand-green" },
  ENDED: { label: "已结束", className: "bg-gray-100 text-text-muted" },
};

async function fetchRallies(eventId: string) {
  const res = await fetch(`/api/events/${eventId}/stamp-rallies`);
  if (!res.ok) throw new Error("加载失败");
  return (await res.json()).data.rallies as ApiStampRally[];
}

export function StampRallyHubClient({
  eventId,
  eventName,
}: {
  eventId: string;
  eventName: string;
}) {
  const queryClient = useQueryClient();
  const router = useRouter();

  const { data: rallies = [], isLoading } = useQuery({
    queryKey: ["stamp-rallies", eventId],
    queryFn: () => fetchRallies(eventId),
  });

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ["stamp-rallies", eventId] });
    void queryClient.invalidateQueries({ queryKey: ["stamp-monitor", eventId] });
  }

  async function startRally(rally: ApiStampRally) {
    const res = await fetch(
      `/api/events/${eventId}/stamp-rallies/${rally.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "ACTIVE" }),
      },
    );
    if (!res.ok) {
      toast.error("启动失败");
      return;
    }
    toast.success("集章路线已开始");
    refresh();
  }

  return (
    <AdminPage>
      <AdminHeader
        title="集章打卡"
        description={eventName}
        breadcrumb={["互动管理", "集章打卡"]}
        actions={
          <div className="flex items-center gap-2">
            <Link
              href="#monitor"
              className={buttonVariants({ variant: "outline" })}
            >
              <BarChart3 className="mr-1.5 size-4" />
              集章监控
            </Link>
            <Link
              href={`/events/${eventId}/stamp-rally/new`}
              className={buttonVariants({
                variant: "default",
                className: "bg-brand-blue text-white hover:bg-brand-blue/90",
              })}
            >
              新建集章打卡
            </Link>
          </div>
        }
      />

      <AdminContent>
        {isLoading && (
          <p className="py-12 text-center text-sm text-text-muted">加载中…</p>
        )}

        {!isLoading && rallies.length === 0 && (
          <div className="rounded-xl border border-border-light bg-white py-16 text-center">
            <Trophy className="mx-auto size-10 text-brand-gold/60" />
            <p className="mt-3 text-text-muted">暂无集章路线</p>
            <Link
              href={`/events/${eventId}/stamp-rally/new`}
              className={buttonVariants({
                variant: "default",
                className:
                  "mt-4 bg-brand-blue text-white hover:bg-brand-blue/90",
              })}
            >
              新建集章打卡
            </Link>
          </div>
        )}

        <div className="space-y-3">
          {rallies.map((rally) => {
            const status = STATUS_LABEL[rally.status] ?? STATUS_LABEL.DRAFT!;
            return (
              <div
                key={rally.id}
                className="flex flex-wrap items-center gap-4 rounded-xl border border-border-light bg-white p-5"
              >
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-gold/20">
                  <Trophy className="size-5 text-brand-gold" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-[var(--admin-ink)]">
                      {rally.name}
                    </p>
                    <Badge className={cn("font-normal", status.className)}>
                      {status.label}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-text-muted">{rally.prize}</p>
                  <p className="mt-0.5 text-xs text-text-tertiary">
                    目标 {rally.required_count} 章 · 共 {rally.total_booths} 个展位章
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-2xl font-bold text-brand-blue">
                    {rally.participant_count}
                  </p>
                  <p className="text-xs text-text-muted">参与人数</p>
                  <p className="mt-1 text-sm text-brand-green">
                    完成 {rally.completed_count} 人
                  </p>
                </div>

                <div className="flex shrink-0 flex-wrap gap-2">
                  <Link
                    href={`/events/${eventId}/stamp-rally/${rally.id}/edit`}
                    className={buttonVariants({ variant: "outline", size: "sm" })}
                  >
                    修改
                  </Link>
                  {rally.status === "DRAFT" && (
                    <Button
                      size="sm"
                      className="bg-brand-green text-white hover:bg-brand-green/90"
                      onClick={() => void startRally(rally)}
                    >
                      发布
                    </Button>
                  )}
                  {(rally.status === "ACTIVE" || rally.status === "ENDED") && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          router.push(
                            `/events/${eventId}/stamp-rally/${rally.id}/progress`,
                          )
                        }
                      >
                        打卡详情
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          router.push(
                            `/events/${eventId}/stamp-rally/${rally.id}/results`,
                          )
                        }
                      >
                        查看结果
                      </Button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {!isLoading && rallies.length > 0 && (
          <div className="mt-10 border-t border-border-light pt-8">
            <StampMonitorPanel eventId={eventId} />
          </div>
        )}
      </AdminContent>
    </AdminPage>
  );
}
