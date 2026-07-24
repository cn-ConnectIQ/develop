"use client";

import { useEffect, useState } from "react";
import { Copy, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { withPublicPath } from "@/lib/public-path";

type JoinQrPayload = {
  scanUrl: string | null;
  qrUrl: string | null;
  wxacodeUrl: string | null;
  sessionCode: string | null;
};

type ParticipantLotteryJoinQrDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
  lotteryId: string;
  title: string;
};

export function ParticipantLotteryJoinQrDialog({
  open,
  onOpenChange,
  eventId,
  lotteryId,
  title,
}: ParticipantLotteryJoinQrDialogProps) {
  const [loading, setLoading] = useState(false);
  const [join, setJoin] = useState<JoinQrPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setJoin(null);

    void (async () => {
      try {
        const res = await fetch(
          withPublicPath(
            `/api/events/${eventId}/lotteries/${lotteryId}/join-qr`,
          ),
        );
        const json = (await res.json()) as {
          message?: string;
          data?: JoinQrPayload;
        };
        if (!res.ok) {
          throw new Error(json.message ?? "获取扫码失败");
        }
        if (cancelled) return;
        const data = json.data ?? null;
        if (
          !data?.wxacodeUrl &&
          !data?.qrUrl &&
          !data?.scanUrl &&
          !data?.sessionCode
        ) {
          setError("暂无扫码入口，请确认抽奖已发布");
          setJoin(null);
          return;
        }
        setJoin(data);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "获取扫码失败");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, eventId, lotteryId]);

  const imageUrl = join?.wxacodeUrl || join?.qrUrl || null;

  async function copyScanUrl() {
    if (!join?.scanUrl) return;
    try {
      await navigator.clipboard.writeText(join.scanUrl);
      toast.success("参与链接已复制");
    } catch {
      toast.error("复制失败");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>获取小程序扫码参与</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-text-secondary">
          「{title}」· 观众微信扫码即可参与
        </p>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-text-secondary">
            <Loader2 className="size-4 animate-spin" />
            正在生成小程序码…
          </div>
        ) : error ? (
          <p className="py-8 text-center text-sm text-destructive">{error}</p>
        ) : (
          <div className="space-y-4">
            <div className="flex justify-center">
              {imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={imageUrl}
                  alt="小程序扫码参与"
                  className="size-[200px] rounded-lg border border-border bg-white object-contain p-2"
                />
              ) : (
                <div className="flex size-[200px] items-center justify-center rounded-lg border border-dashed border-border text-xs text-text-secondary">
                  暂无二维码图
                </div>
              )}
            </div>
            <div className="space-y-1 text-center">
              {join?.wxacodeUrl ? (
                <p className="text-xs font-medium text-brand-blue">
                  微信小程序码
                </p>
              ) : null}
              {join?.sessionCode ? (
                <p className="font-mono text-sm text-text-secondary">
                  码：{join.sessionCode}
                </p>
              ) : null}
              {join?.scanUrl ? (
                <p className="break-all text-xs text-text-tertiary">
                  {join.scanUrl}
                </p>
              ) : null}
            </div>
            {join?.scanUrl ? (
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => void copyScanUrl()}
              >
                <Copy className="mr-1.5 size-4" />
                复制参与链接
              </Button>
            ) : null}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
