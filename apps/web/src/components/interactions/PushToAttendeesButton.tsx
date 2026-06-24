"use client";

import { useState } from "react";
import { Megaphone } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type InteractionPushKind = "poll" | "lottery" | "qna";

type PushToAttendeesButtonProps = {
  eventId: string;
  kind: InteractionPushKind;
  targetId: string;
  className?: string;
  size?: "sm" | "default";
  variant?: "default" | "outline";
};

export function PushToAttendeesButton({
  eventId,
  kind,
  targetId,
  className,
  size = "sm",
  variant = "outline",
}: PushToAttendeesButtonProps) {
  const [pushing, setPushing] = useState(false);

  async function handlePush() {
    setPushing(true);
    try {
      const res = await fetch(`/api/events/${eventId}/interactions/push`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, id: targetId }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.message ?? "推送失败");
      }
      const json = await res.json();
      const { sent, skipped } = json.data as { sent: number; skipped: number };
      toast.success(`已推送 ${sent} 人${skipped > 0 ? `，${skipped} 人未绑定账号` : ""}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "推送失败");
    } finally {
      setPushing(false);
    }
  }

  return (
    <Button
      type="button"
      size={size}
      variant={variant}
      disabled={pushing}
      className={cn("gap-1.5", className)}
      onClick={() => void handlePush()}
    >
      <Megaphone className="size-3.5" />
      {pushing ? "推送中…" : "推送到全场"}
    </Button>
  );
}

export function OpenBigscreenButton({
  eventId,
  className,
}: {
  eventId: string;
  className?: string;
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      className={className}
      onClick={() =>
        window.open(`/events/${eventId}/interactions/bigscreen`, "_blank")
      }
    >
      打开大屏
    </Button>
  );
}
