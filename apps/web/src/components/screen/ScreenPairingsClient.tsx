"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Monitor, Unplug } from "lucide-react";
import { toast } from "sonner";
import {
  AdminContent,
  AdminHeader,
  AdminPage,
} from "@/components/admin/admin-header";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { getScreenPairingPublicUrl } from "@/lib/screen-pairing/public-url";
import type { ScreenPairingStatusPayload } from "@/lib/screen-pairing/shared";
import { withPublicPath } from "@/lib/public-path";
import { cn } from "@/lib/utils";

function typeLabel(type: string | null) {
  if (type === "LOTTERY") return "抽奖";
  if (type === "POLL") return "投票";
  if (type === "QA") return "问答";
  return "互动";
}

async function fetchPairings(eventId: string) {
  const res = await fetch(
    withPublicPath(`/api/events/${eventId}/screen-pairings`),
  );
  if (!res.ok) throw new Error("加载失败");
  const json = await res.json();
  return (json.data?.items ?? []) as ScreenPairingStatusPayload[];
}

export function ScreenPairingsClient({
  eventId,
  eventName,
}: {
  eventId: string;
  eventName: string;
}) {
  const queryClient = useQueryClient();
  const screenUrl = getScreenPairingPublicUrl();

  const { data: items = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["screen-pairings", eventId],
    queryFn: () => fetchPairings(eventId),
    refetchInterval: 8_000,
  });

  async function unbind(item: ScreenPairingStatusPayload) {
    if (!item.interactionId) {
      toast.error("无法解绑：缺少互动 ID");
      return;
    }
    const res = await fetch(
      withPublicPath(
        `/api/screen-pairing/${encodeURIComponent(item.pairingToken)}/reset`,
      ),
      { method: "POST" },
    );
    if (!res.ok) {
      toast.error("解绑失败");
      return;
    }
    toast.success("已断开该大屏");
    void queryClient.invalidateQueries({
      queryKey: ["screen-pairings", eventId],
    });
  }

  return (
    <AdminPage>
      <AdminHeader
        title="大屏配对"
        description={eventName}
        breadcrumb={["现场执行", "大屏配对"]}
        actions={
          <a
            href={screenUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonVariants({
              variant: "default",
              className: "bg-brand-green text-white hover:bg-brand-green/90",
            })}
          >
            <ExternalLink className="mr-1.5 size-4" />
            打开配对页 {screenUrl.replace(/^https?:\/\//, "")}
          </a>
        }
      />

      <AdminContent>
        <div className="mb-6 rounded-xl border border-border bg-surface px-5 py-4 text-[13px] leading-relaxed text-text-secondary">
          现场投影浏览器打开{" "}
          <a
            href={screenUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-brand-green underline-offset-2 hover:underline"
          >
            {screenUrl}
          </a>
          ，用小程序扫码绑定投票 / 抽奖 / 问答。下方为当前已连接大屏。
        </div>

        {isLoading && (
          <p className="py-12 text-center text-sm text-text-muted">加载中…</p>
        )}

        {isError && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-5 py-8 text-center">
            <p className="text-sm text-destructive">加载配对状态失败</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => void refetch()}
            >
              重试
            </Button>
          </div>
        )}

        {!isLoading && !isError && items.length === 0 && (
          <div className="rounded-xl border border-border-light bg-white py-16 text-center">
            <Monitor className="mx-auto size-10 text-text-tertiary/50" />
            <p className="mt-3 text-text-muted">暂无已连接大屏</p>
            <p className="mt-1 text-xs text-text-tertiary">
              打开配对页后，使用小程序扫码即可连接
            </p>
          </div>
        )}

        <div className="space-y-3">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex flex-wrap items-center gap-4 rounded-xl border border-border-light bg-white p-5"
            >
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-green-soft">
                <Monitor className="size-5 text-brand-green" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-text-primary">
                    {item.interactionName ?? "未命名互动"}
                  </p>
                  <Badge
                    className={cn(
                      "font-normal",
                      item.screenOnline
                        ? "bg-brand-green-soft text-brand-green"
                        : "bg-surface-secondary text-text-tertiary",
                    )}
                  >
                    {item.screenOnline ? "在线" : "离线"}
                  </Badge>
                  <Badge variant="secondary" className="font-normal">
                    {typeLabel(item.interactionType)}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-text-tertiary">
                  Token · {item.pairingToken.slice(0, 8)}…
                  {item.pairedAt
                    ? ` · 连接于 ${new Date(item.pairedAt).toLocaleString("zh-CN")}`
                    : null}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="text-brand-red"
                onClick={() => void unbind(item)}
              >
                <Unplug className="mr-1 size-3.5" />
                断开
              </Button>
            </div>
          ))}
        </div>
      </AdminContent>
    </AdminPage>
  );
}
