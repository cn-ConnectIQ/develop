"use client";

import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { AccountType } from "@connectiq/database";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export type ApplicationRow = {
  id: string;
  status: string;
  accountType: AccountType;
  accountTypeLabel: string;
  orgName: string;
  orgCreditCode: string | null;
  orgWebsite: string | null;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  description: string;
  submittedAt: string;
  user: {
    id: string;
    name: string;
    phone: string | null;
    email: string;
    createdAt: string;
  };
};

const TYPE_BADGE: Record<AccountType, string> = {
  CONFERENCE_ORGANIZER: "bg-brand-blue-light text-brand-blue",
  EXPO_ORGANIZER: "bg-brand-green-light text-brand-green",
  EXHIBITOR: "bg-brand-amber-light text-brand-amber",
};

type Props = {
  application: ApplicationRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReviewed: () => void;
};

export function ApplicationReviewSheet({
  application,
  open,
  onOpenChange,
  onReviewed,
}: Props) {
  const [reviewerNotes, setReviewerNotes] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [loading, setLoading] = useState<string | null>(null);

  async function submitReview(
    status: "APPROVED" | "REJECTED" | "REVISION_REQUIRED",
  ) {
    if (!application) return;
    if (
      (status === "REJECTED" || status === "REVISION_REQUIRED") &&
      !rejectionReason.trim()
    ) {
      toast.error("请填写拒绝/修改原因");
      return;
    }

    setLoading(status);
    try {
      const res = await fetch(
        `/api/platform/applications/${application.id}/review`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status,
            reviewer_notes: reviewerNotes || undefined,
            rejection_reason: rejectionReason || undefined,
          }),
        },
      );
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "操作失败");
        return;
      }

      if (status === "APPROVED") {
        toast.success("已通过审核，组织主页已创建");
      } else if (status === "REJECTED") {
        toast.success("已拒绝申请");
      } else {
        toast.success("已要求申请人补充资料");
      }

      setReviewerNotes("");
      setRejectionReason("");
      onOpenChange(false);
      onReviewed();
    } finally {
      setLoading(null);
    }
  }

  if (!application) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        className="w-full overflow-y-auto sm:max-w-[560px]"
        showCloseButton
      >
        <SheetHeader>
          <SheetTitle>审核账号申请</SheetTitle>
        </SheetHeader>

        <div className="space-y-5 px-1 pb-6">
          <div className="rounded-xl bg-content-bg p-4">
            <div className="flex items-center gap-3">
              <Avatar className="size-10">
                <AvatarFallback className="bg-brand-blue-light text-brand-blue">
                  {application.user.name.slice(0, 1)}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium">{application.user.name}</p>
                <p className="text-sm text-text-muted">
                  {application.user.phone ?? application.user.email}
                </p>
                <p className="text-xs text-text-muted">
                  注册于{" "}
                  {format(new Date(application.user.createdAt), "yyyy-MM-dd", {
                    locale: zhCN,
                  })}
                </p>
              </div>
            </div>
            <span
              className={cn(
                "mt-3 inline-block rounded-full px-3 py-1 text-xs font-medium",
                TYPE_BADGE[application.accountType],
              )}
            >
              {application.accountTypeLabel}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            {[
              ["组织名", application.orgName],
              ["信用代码", application.orgCreditCode ?? "—"],
              ["官网", application.orgWebsite ?? "—"],
              ["联系人", application.contactName],
              ["联系邮箱", application.contactEmail],
              ["联系手机", application.contactPhone],
            ].map(([label, value]) => (
              <div key={label}>
                <p className="text-text-muted">{label}</p>
                <p className="mt-0.5 font-medium break-all">{value}</p>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-border-light bg-white p-4">
            <p className="mb-2 text-sm font-medium">申请说明</p>
            <p className="text-sm leading-[1.8] text-[var(--admin-ink)]">
              {application.description}
            </p>
          </div>

          <div className="space-y-3">
            <div>
              <p className="mb-1 text-sm font-medium">
                审核备注（仅平台内部可见）
              </p>
              <Textarea
                value={reviewerNotes}
                onChange={(e) => setReviewerNotes(e.target.value)}
                placeholder="内部备注..."
                className="min-h-[80px] rounded-xl"
              />
            </div>
            <div>
              <p className="mb-1 text-sm font-medium">
                拒绝原因（发送给申请人，拒绝时必填）
              </p>
              <Textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="申请人可见的拒绝或修改说明..."
                className="min-h-[80px] rounded-xl"
              />
            </div>
          </div>

          <div className="flex gap-3">
            <Button
              type="button"
              className="h-11 flex-1 bg-brand-green font-semibold text-white hover:bg-brand-green/90"
              disabled={!!loading}
              onClick={() => void submitReview("APPROVED")}
            >
              {loading === "APPROVED" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                "✓ 审核通过"
              )}
            </Button>
            <Button
              type="button"
              className="h-11 flex-1 bg-brand-red text-white hover:bg-brand-red/90"
              disabled={!!loading}
              onClick={() => void submitReview("REJECTED")}
            >
              {loading === "REJECTED" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                "✕ 拒绝申请"
              )}
            </Button>
          </div>
          <Button
            type="button"
            variant="outline"
            className="h-11 w-full text-text-muted"
            disabled={!!loading}
            onClick={() => void submitReview("REVISION_REQUIRED")}
          >
            {loading === "REVISION_REQUIRED" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              "← 返回修改（要求申请人补充资料）"
            )}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
