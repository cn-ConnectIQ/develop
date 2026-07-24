"use client";

import { toast } from "sonner";

const BILLING_HREF = "/organizer/billing";

/** 判断是否为短信/邮件额度不足（含后端友好文案） */
export function isInviteCreditError(message: string | null | undefined) {
  if (!message) return false;
  return (
    message.includes("额度不足") ||
    message.includes("余额不足") ||
    message.includes("请先充值") ||
    message.includes("计费与充值")
  );
}

/**
 * 邀请发送失败时：额度不足则 toast +「去充值」动作；其它错误普通提示。
 */
export function toastInviteSendError(error: unknown, fallback = "发送失败") {
  const message = error instanceof Error ? error.message : fallback;
  const redirectTo =
    error && typeof error === "object" && "redirectTo" in error
      ? String((error as { redirectTo?: string }).redirectTo || "")
      : "";

  if (isInviteCreditError(message) || redirectTo.includes("billing")) {
    toast.error(message, {
      duration: 12000,
      description: "可前往计费中心充值短信/邮件额度后重试",
      action: {
        label: "去充值",
        onClick: () => {
          window.location.href = redirectTo || BILLING_HREF;
        },
      },
    });
    return;
  }

  if (message.includes("邀请体系未开启")) {
    toast.error(message, {
      duration: 14000,
      description: "默认关闭；在活动设置的功能开关里打开即可发送邀请",
    });
    return;
  }

  toast.error(message || fallback);
}
