import { ErrorCode } from "@connectiq/types";
import { z } from "zod";
import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api-auth";
import {
  assertBaigeWebhookSignature,
  BaigePartnerAuthError,
} from "@/lib/integrations/baige-partner-auth";
import { dispatchBaigeWebhook } from "@/lib/integrations/baige-webhook-dispatch";

const bodySchema = z.object({
  event: z.string().min(1).optional(),
  type: z.string().min(1).optional(),
  event_type: z.string().min(1).optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
  data: z.record(z.string(), z.unknown()).optional(),
  // 兼容旧 stub：{ source, payload }
  source: z.string().optional(),
});

export const POST = withErrorHandler(async (request) => {
  const rawBody = await request.text();
  try {
    assertBaigeWebhookSignature(request, rawBody);
  } catch (error) {
    if (error instanceof BaigePartnerAuthError) {
      return createErrorResponse(error.message, ErrorCode.UNAUTHORIZED, error.status);
    }
    throw error;
  }

  let json: unknown = {};
  try {
    json = rawBody ? JSON.parse(rawBody) : {};
  } catch {
    return createErrorResponse("JSON 无效", ErrorCode.VALIDATION_ERROR, 400);
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return createErrorResponse("参数错误", ErrorCode.VALIDATION_ERROR, 400);
  }

  const eventType =
    parsed.data.event ||
    parsed.data.type ||
    parsed.data.event_type ||
    parsed.data.source ||
    "unknown";

  const payload =
    parsed.data.payload ||
    parsed.data.data ||
    (typeof json === "object" && json && !Array.isArray(json)
      ? (json as Record<string, unknown>)
      : {});

  try {
    const result = await dispatchBaigeWebhook({
      eventType,
      payload,
      raw: json,
    });
    return createSuccessResponse(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "处理失败";
    return createErrorResponse(message, ErrorCode.VALIDATION_ERROR, 400);
  }
});
