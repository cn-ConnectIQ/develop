import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest } from "next/server";
import { createSuccessResponse, withErrorHandler } from "@/lib/api-auth";
import { applyInviteDeliveryEvent } from "@/lib/invite/delivery";
import { applyNotificationDeliveryEvent } from "@/lib/notification/delivery-webhook";
import { addOptOut } from "@/lib/notification/compliance";

/**
 * Mailgun 事件 Webhook。
 * URL: https://9li.co/uc/api/webhooks/mailgun
 * 建议订阅: delivered / failed / opened / clicked / complained
 * 签名密钥: MAILGUN_WEBHOOK_SIGNING_KEY（Mailgun HTTP webhook signing key）
 */

function verifyMailgunSignature(input: {
  timestamp: string;
  token: string;
  signature: string;
}): boolean {
  const key = process.env.MAILGUN_WEBHOOK_SIGNING_KEY?.trim();
  if (!key) {
    return process.env.NODE_ENV !== "production";
  }
  const encoded = createHmac("sha256", key)
    .update(input.timestamp + input.token)
    .digest("hex");
  try {
    const a = Buffer.from(encoded);
    const b = Buffer.from(input.signature);
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function mapMailgunEvent(
  event: string,
):
  | "delivered"
  | "failed"
  | "opened"
  | "clicked"
  | "permanently_failed"
  | "complained"
  | null {
  switch (event) {
    case "delivered":
      return "delivered";
    case "failed":
    case "rejected":
      return "failed";
    case "permanent_fail":
    case "permanently_failed":
      return "permanently_failed";
    case "opened":
      return "opened";
    case "clicked":
      return "clicked";
    case "complained":
      return "complained";
    default:
      return null;
  }
}

function extractSignature(payload: Record<string, unknown>) {
  const sigObj = payload.signature;
  if (sigObj && typeof sigObj === "object") {
    const s = sigObj as {
      timestamp?: string | number;
      token?: string;
      signature?: string;
    };
    return {
      timestamp: String(s.timestamp ?? ""),
      token: String(s.token ?? ""),
      signature: String(s.signature ?? ""),
    };
  }
  return {
    timestamp: String(payload.timestamp ?? ""),
    token: String(payload.token ?? ""),
    signature: String(payload.signature ?? ""),
  };
}

export const POST = withErrorHandler(async (request: NextRequest) => {
  const contentType = request.headers.get("content-type") ?? "";
  let payload: Record<string, unknown> = {};

  if (contentType.includes("application/json")) {
    payload = (await request.json()) as Record<string, unknown>;
  } else {
    const form = await request.formData();
    form.forEach((value, key) => {
      payload[key] = typeof value === "string" ? value : value.name;
    });
  }

  const sig = extractSignature(payload);
  if (
    sig.timestamp &&
    sig.token &&
    sig.signature &&
    !verifyMailgunSignature(sig)
  ) {
    return new Response(JSON.stringify({ error: "Invalid signature" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const eventData = (payload["event-data"] ?? payload) as Record<
    string,
    unknown
  >;
  const eventName = String(eventData.event ?? payload.event ?? "").toLowerCase();
  const mapped = mapMailgunEvent(eventName);
  if (!mapped) {
    return createSuccessResponse({ ignored: true, event: eventName });
  }

  const userVariables = (eventData["user-variables"] ??
    eventData.userVariables ??
    {}) as Record<string, string>;

  const recordId =
    userVariables.invite_record_id ||
    String(payload["v:invite_record_id"] ?? "");
  const notificationRecordId =
    userVariables.notification_record_id ||
    String(payload["v:notification_record_id"] ?? "");

  const message = (eventData.message ?? {}) as {
    headers?: { "message-id"?: string };
  };
  const vendorMessageId = String(
    message.headers?.["message-id"] ??
      eventData["message-id"] ??
      payload["Message-Id"] ??
      payload["message-id"] ??
      "",
  );

  const severity = String(eventData.severity ?? "");
  const deliveryStatus = (eventData["delivery-status"] ?? {}) as {
    message?: string;
    description?: string;
  };
  const errorMessage =
    deliveryStatus.message ||
    deliveryStatus.description ||
    (severity ? `severity=${severity}` : null);

  const result = await applyInviteDeliveryEvent({
    recordId: recordId || null,
    vendorMessageId: vendorMessageId || null,
    event:
      mapped === "failed" && severity === "permanent"
        ? "permanently_failed"
        : mapped,
    errorMessage,
  });

  if (notificationRecordId || vendorMessageId) {
    const nEvent =
      mapped === "delivered"
        ? "delivered"
        : mapped === "clicked"
          ? "clicked"
          : mapped === "failed" || mapped === "permanently_failed"
            ? "failed"
            : mapped === "complained"
              ? "bounced"
              : null;
    if (nEvent) {
      await applyNotificationDeliveryEvent({
        recordId: notificationRecordId || null,
        providerMsgId: vendorMessageId || null,
        event: nEvent,
        errorCode: errorMessage,
      });
    }
  }

  if (mapped === "complained") {
    const recipient = String(
      (eventData.recipient as string) ||
        userVariables.email ||
        "",
    );
    if (recipient.includes("@")) {
      await addOptOut({
        identityType: "email",
        identityValue: recipient,
        scope: "GLOBAL",
        source: "EMAIL_LINK",
      }).catch(() => undefined);
    }
  }

  return createSuccessResponse(result);
});
