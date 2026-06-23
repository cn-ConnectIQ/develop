"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Trophy } from "lucide-react";
import { toast } from "sonner";
import {
  AdminContent,
  AdminHeader,
  AdminPage,
} from "@/components/admin/admin-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  StampRallyConfigSheet,
  type BoothOption,
} from "@/components/stamp-rally/StampRallyConfigSheet";
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

async function fetchBooths(eventId: string) {
  const res = await fetch(
    `/api/events/${eventId}/stamp-rallies?include=booths`,
  );
  if (!res.ok) throw new Error("加载展位失败");
  return (await res.json()).data.booths as BoothOption[];
}

export function StampRallyPageClient({
  eventId,
  eventName,
}: {
  eventId: string;
  eventName: string;
}) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editRally, setEditRally] = useState<ApiStampRally | null>(null);

  const { data: rallies = [], isLoading } = useQuery({
    queryKey: ["stamp-rallies", eventId],
    queryFn: () => fetchRallies(eventId),
  });

  const { data: booths = [] } = useQuery({
    queryKey: ["stamp-rally-booths", eventId],
    queryFn: () => fetchBooths(eventId),
  });

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ["stamp-rallies", eventId] });
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

  function openCreate() {
    setEditRally(null);
    setSheetOpen(true);
  }

  function openEdit(rally: ApiStampRally) {
    setEditRally(rally);
    setSheetOpen(true);
  }

  function viewResults(rally: ApiStampRally) {
    router.push(`/events/${eventId}/stamp-rally/${rally.id}/results`);
  }

  return (
    <AdminPage>
      <AdminHeader
        title="集章打卡配置"
        description={eventName}
        breadcrumb={["展会", "集章打卡"]}
        actions={
          <Button
            className="bg-brand-blue text-white hover:bg-brand-blue/90"
            onClick={openCreate}
          >
            + 创建集章路线
          </Button>
        }
      />

      <AdminContent>
        {isLoading && (
          <p className="py-12 text-center text-sm text-text-muted">加载中…</p>
        )}

        {!isLoading && rallies.length === 0 && (
          <div className="rounded-xl border border-border-light bg-white py-16 text-center">
            <Trophy className="mx-auto size-10 text-brand-gold/60" />
            <p className="mt-3 text-text-muted">暂无集章路线，点击右上角创建</p>
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
                    {rally.required_count}/{rally.total_booths} 个章
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

                <div className="flex shrink-0 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openEdit(rally)}
                  >
                    配置
                  </Button>
                  {rally.status === "DRAFT" && (
                    <Button
                      size="sm"
                      className="bg-brand-green text-white hover:bg-brand-green/90"
                      onClick={() => void startRally(rally)}
                    >
                      开始
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
                        集章进度
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => viewResults(rally)}
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
      </AdminContent>

      <StampRallyConfigSheet
        eventId={eventId}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        booths={booths}
        editRally={editRally}
        onSuccess={refresh}
      />
    </AdminPage>
  );
}
