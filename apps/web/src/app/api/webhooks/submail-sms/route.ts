import { NextRequest } from "next/server";
import { InviteChannel } from "@connectiq/database";
import { createSuccessResponse, withErrorHandler } from "@/lib/api-auth";
import { applyInviteDeliveryEvent } from "@/lib/invite/delivery";
import { upsertInviteBlock } from "@/lib/invite/blocklist";
import {
  applyNotificationDeliveryEvent,
  handleSmsOptOutReply,
} from "@/lib/notification/delivery-webhook";

/**
 * 赛邮 SUBHOOK 回调。
 * URL: https://9li.co/uc/api/webhooks/submail-sms
 * 文档: https://www.mysubmail.com/documents/GHVPT
 *
 * 发送时 tag = invite_record_id，据此回写送达/失败；上行含「R」则退订拉黑。
 */

function authorize(request: NextRequest) {
  const secret =
    process.env.SUBMAIL_WEBHOOK_SECRET?.trim() ||
    process.env.CRON_SECRET?.trim();
  if (!secret) return process.env.NODE_ENV !== "production";
  const auth = request.headers.get("authorization");
  const token =
    request.headers.get("x-submail-token") ||
    request.nextUrl.searchParams.get("token");
  return auth === `Bearer ${secret}` || token === secret;
}

export const POST = withErrorHandler(async (request: NextRequest) => {
  if (!authorize(request)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const payload = (await request.json()) as {
    events?: string;
    event?: string;
    tag?: string | number;
    send_id?: string;
    report?: string;
    report_desc?: string;
    content?: string;
    address?: string;
    phone?: string;
  };

  const events = String(payload.events || payload.event || "").toLowerCase();
  const tag = payload.tag != null ? String(payload.tag) : "";
  const sendId = payload.send_id || "";
  const phone = (payload.address || payload.phone || "").trim();

  if (events === "delivered") {
    const result = await applyInviteDeliveryEvent({
      recordId: tag || null,
      vendorMessageId: sendId || null,
      event: "delivered",
    });
    await applyNotificationDeliveryEvent({
      recordId: tag || null,
      providerMsgId: sendId || null,
      event: "delivered",
    });
    return createSuccessResponse({ events, result });
  }

  if (events === "dropped") {
    const errorMessage =
      payload.report_desc || payload.report || "Submail 发送失败";
    const result = await applyInviteDeliveryEvent({
      recordId: tag || null,
      vendorMessageId: sendId || null,
      event: "failed",
      errorMessage,
    });
    await applyNotificationDeliveryEvent({
      recordId: tag || null,
      providerMsgId: sendId || null,
      event: "failed",
      errorCode: errorMessage,
    });
    if (
      phone &&
      (errorMessage.includes("空号") || errorMessage.includes("黑名单"))
    ) {
      await upsertInviteBlock({
        destination: phone,
        channel: InviteChannel.SMS,
        reason: "HARD_BOUNCE",
        note: errorMessage,
      }).catch(() => undefined);
    }
    return createSuccessResponse({ events, result });
  }

  if (events === "mo") {
    const content = (payload.content || "").trim();
    const normalized = content.replace(/\s+/g, "").toUpperCase();
    if (phone && (normalized === "R" || normalized.includes("拒收"))) {
      await upsertInviteBlock({
        destination: phone,
        channel: InviteChannel.SMS,
        reason: "UNSUBSCRIBE",
        note: content,
      });
    }
    if (phone) {
      const opted = await handleSmsOptOutReply(phone, content);
      if (opted) {
        return createSuccessResponse({ events, unsubscribed: true, phone });
      }
    }
    return createSuccessResponse({ events, ignored: true, content });
  }

  return createSuccessResponse({ events, ignored: true });
});
