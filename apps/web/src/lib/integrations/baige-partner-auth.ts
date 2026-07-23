import { createHmac, timingSafeEqual } from "crypto";
import type { NextRequest } from "next/server";
import {
  getBaigePartnerApiKey,
  getBaigeWebhookSecret,
  isBaigePartnerDevMode,
} from "@/lib/integrations/baige-partner-constants";

export class BaigePartnerAuthError extends Error {
  constructor(
    message: string,
    public status = 401,
    public code = "UNAUTHORIZED",
  ) {
    super(message);
  }
}

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/** Bearer 伙伴 API Key（百格服务端调玖莅） */
export function assertBaigePartnerApiKey(request: NextRequest) {
  if (isBaigePartnerDevMode() && !getBaigePartnerApiKey()) {
    return { mode: "dev" as const };
  }

  const expected = getBaigePartnerApiKey();
  if (!expected) {
    throw new BaigePartnerAuthError("未配置 BAIGE_PARTNER_API_KEY", 503, "NOT_CONFIGURED");
  }

  const header = request.headers.get("authorization") ?? "";
  const token = header.toLowerCase().startsWith("bearer ")
    ? header.slice(7).trim()
    : (request.headers.get("x-baige-api-key") ?? "").trim();

  if (!token || !safeEqual(token, expected)) {
    throw new BaigePartnerAuthError("伙伴 API Key 无效");
  }

  return { mode: "key" as const };
}

/** Webhook HMAC：X-Baige-Signature = sha256=hex(hmac(secret, timestamp + "." + rawBody)) */
export function assertBaigeWebhookSignature(
  request: NextRequest,
  rawBody: string,
) {
  if (isBaigePartnerDevMode() && !getBaigeWebhookSecret()) {
    return { mode: "dev" as const };
  }

  const secret = getBaigeWebhookSecret();
  if (!secret) {
    throw new BaigePartnerAuthError("未配置 BAIGE_WEBHOOK_SECRET", 503, "NOT_CONFIGURED");
  }

  const timestamp = request.headers.get("x-baige-timestamp") ?? "";
  const signature = request.headers.get("x-baige-signature") ?? "";
  if (!timestamp || !signature) {
    throw new BaigePartnerAuthError("缺少 webhook 签名头");
  }

  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) {
    throw new BaigePartnerAuthError("webhook 时间戳无效");
  }
  const skewMs = Math.abs(Date.now() - ts);
  if (skewMs > 5 * 60 * 1000) {
    throw new BaigePartnerAuthError("webhook 时间戳过期", 401, "TIMESTAMP_EXPIRED");
  }

  const expected =
    "sha256=" +
    createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");

  if (!safeEqual(signature, expected)) {
    throw new BaigePartnerAuthError("webhook 签名校验失败");
  }

  return { mode: "hmac" as const };
}
