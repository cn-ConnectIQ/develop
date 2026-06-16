"use client";

import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import { CheckCircle2, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export type EventReviewRow = {
  id: string;
  status: string;
  statusLabel: string;
  submittedAt: string;
  event: {
    id: string;
    name: string;
    typeLabel: string;
    description: string | null;
    location: string | null;
    startDate: string | null;
    endDate: string | null;
    status: string;
    org: {
      name: string;
      isVerified: boolean;
      accountTypeLabel: string;
    } | null;
    organizerName: string;
    organizerEmail?: string | null;
  };
};

type Props = {
  review: EventReviewRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReviewed: () => void;
};

export function EventReviewSheet({
  review,
  open,
  onOpenChange,
  onReviewed,
}: Props) {
  const [reviewerNotes, setReviewerNotes] = useState("");
  const [feedback, setFeedback] = useState("");
  const [loading, setLoading] = useState<string | null>(null);

  async function submitReview(
    status: "APPROVED" | "REJECTED" | "REVISION_REQUIRED",
  ) {
    if (!review) return;
    setLoading(status);
    try {
      const res = await fetch(`/api/platform/event-reviews/${review.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          reviewer_notes: reviewerNotes || undefined,
          feedback: feedback || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "操作失败");
        return;
      }

      const messages = {
        APPROVED: "活动已通过发布审核",
        REJECTED: "已拒绝活动发布",
        REVISION_REQUIRED: "已要求主办方修改",
      };
      toast.success(messages[status]);
      setReviewerNotes("");
      setFeedback("");
      onOpenChange(false);
      onReviewed();
    } finally {
      setLoading(null);
    }
  }

  if (!review) return null;

  const event = review.event;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        className="w-full overflow-y-auto p-0 sm:max-w-[640px]"
        showCloseButton
      >
        <SheetHeader className="border-b border-border-light px-6 py-4">
          <SheetTitle>活动发布审核</SheetTitle>
        </SheetHeader>

        <div className="grid min-h-0 flex-1 lg:grid-cols-[55%_45%]">
          <div className="space-y-4 border-r border-border-light p-6">
            <div className="flex h-40 max-h-40 items-center justify-center rounded-xl bg-gradient-to-br from-brand-blue-light to-brand-purple-light text-sm text-text-muted">
              活动封面预览
            </div>
            <div>
              <h2 className="text-xl font-bold">{event.name}</h2>
              <p className="mt-1 text-sm text-text-muted">
                {event.startDate
                  ? format(new Date(event.startDate), "yyyy-MM-dd HH:mm", {
                      locale: zhCN,
                    })
                  : "时间待定"}
                {event.location ? ` · ${event.location}` : ""}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-brand-blue-light px-2.5 py-0.5 text-xs font-medium text-brand-blue">
                {event.typeLabel}
              </span>
              <span className="rounded-full bg-content-bg px-2.5 py-0.5 text-xs text-text-muted">
                {event.status}
              </span>
            </div>
            {event.description && (
              <p className="text-sm leading-relaxed text-[var(--admin-ink)]">
                {event.description}
              </p>
            )}
            {event.org && (
              <div className="rounded-xl bg-content-bg p-4 text-sm">
                <p className="font-medium">{event.org.name}</p>
                <div className="mt-1 flex items-center gap-2 text-text-muted">
                  {event.org.isVerified && (
                    <span className="inline-flex items-center gap-0.5 text-brand-blue">
                      <CheckCircle2 className="size-3.5" /> 认证
                    </span>
                  )}
                  <span>{event.org.accountTypeLabel}</span>
                </div>
              </div>
            )}
          </div>

          <div className="sticky top-0 space-y-4 self-start bg-content-bg p-5">
            <p className="text-sm font-medium">审核意见</p>
            <Textarea
              value={reviewerNotes}
              onChange={(e) => setReviewerNotes(e.target.value)}
              placeholder="内部备注，不对外显示"
              rows={3}
              className="rounded-xl bg-white"
            />
            <div>
              <p className="mb-1 text-sm font-medium">
                发送给主办方的反馈（可选）
              </p>
              <Textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="审核通过或拒绝的原因，会通知到主办方"
                rows={3}
                className="rounded-xl bg-white"
              />
            </div>

            <div className="space-y-2">
              <Button
                type="button"
                className="h-11 w-full bg-brand-green text-white hover:bg-brand-green/90"
                disabled={!!loading}
                onClick={() => void submitReview("APPROVED")}
              >
                {loading === "APPROVED" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  "✓ 通过发布"
                )}
              </Button>
              <Button
                type="button"
                className={cn(
                  "h-11 w-full border border-brand-amber bg-brand-amber-light text-brand-amber hover:bg-brand-amber-light/80",
                )}
                disabled={!!loading}
                onClick={() => void submitReview("REVISION_REQUIRED")}
              >
                {loading === "REVISION_REQUIRED" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  "⚠ 要求修改"
                )}
              </Button>
              <Button
                type="button"
                className="h-11 w-full border border-brand-red bg-brand-red-light text-brand-red hover:bg-brand-red-light/80"
                disabled={!!loading}
                onClick={() => void submitReview("REJECTED")}
              >
                {loading === "REJECTED" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  "✕ 拒绝发布"
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-11 w-full text-text-muted"
                onClick={() => onOpenChange(false)}
              >
                ← 待定
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
