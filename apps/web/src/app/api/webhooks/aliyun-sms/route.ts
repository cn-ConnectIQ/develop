import { NextRequest } from "next/server";
import { createSuccessResponse, withErrorHandler } from "@/lib/api-auth";
import { applyInviteDeliveryEvent } from "@/lib/invite/delivery";

/**
 * 阿里云短信状态报告回调。
 * 控制台配置 URL: https://9li.co/uc/api/webhooks/aliyun-sms
 * 鉴权：Authorization: Bearer ${CRON_SECRET} 或 ${ALIYUN_SMS_REPORT_SECRET}
 *
 * 兼容常见字段：biz_id / bizId、success、err_code / err_msg、phone_number
 */

function authorize(request: NextRequest) {
  const secret =
    process.env.ALIYUN_SMS_REPORT_SECRET?.trim() ||
    process.env.CRON_SECRET?.trim();
  if (!secret) return process.env.NODE_ENV !== "production";
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

type ReportItem = {
  biz_id?: string;
  bizId?: string;
  out_id?: string;
  success?: boolean | string;
  err_code?: string;
  err_msg?: string;
  phone_number?: string;
  sms_size?: string;
};

function normalizeItems(body: unknown): ReportItem[] {
  if (Array.isArray(body)) return body as ReportItem[];
  if (body && typeof body === "object") {
    const obj = body as Record<string, unknown>;
    if (Array.isArray(obj.sms_report)) return obj.sms_report as ReportItem[];
    if (Array.isArray(obj.body)) return obj.body as ReportItem[];
    return [obj as ReportItem];
  }
  return [];
}

export const POST = withErrorHandler(async (request: NextRequest) => {
  if (!authorize(request)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const contentType = request.headers.get("content-type") ?? "";
  let raw: unknown;
  if (contentType.includes("application/json")) {
    raw = await request.json();
  } else {
    const text = await request.text();
    try {
      raw = JSON.parse(text);
    } catch {
      // 阿里云有时会把 JSON 数组直接 POST
      raw = text;
    }
  }

  const items = normalizeItems(raw);
  const results = [];

  for (const item of items) {
    const bizId = item.biz_id || item.bizId || item.out_id;
    if (!bizId) continue;

    const success =
      item.success === true ||
      item.success === "true" ||
      item.err_code === "DELIVERED" ||
      item.err_code === "0";

    const failed =
      item.success === false ||
      item.success === "false" ||
      (item.err_code &&
        item.err_code !== "DELIVERED" &&
        item.err_code !== "0" &&
        item.err_code !== "SUCCESS");

    if (!success && !failed) continue;

    results.push(
      await applyInviteDeliveryEvent({
        vendorMessageId: bizId,
        event: success ? "delivered" : "failed",
        errorMessage: failed
          ? `${item.err_code ?? ""} ${item.err_msg ?? ""}`.trim()
          : null,
      }),
    );
  }

  return createSuccessResponse({ count: results.length, results });
});
