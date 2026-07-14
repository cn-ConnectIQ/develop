import { ErrorCode } from "@connectiq/types";
import { z } from "zod";
import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api-auth";
import { addOptOut } from "@/lib/notification/compliance";

const schema = z.object({
  identity_type: z.enum(["phone", "email"]),
  identity_value: z.string().min(3),
  scope: z.enum(["GLOBAL", "EVENT"]).default("GLOBAL"),
  event_id: z.string().optional(),
  source: z.enum(["SMS_REPLY", "EMAIL_LINK", "MANUAL"]).default("EMAIL_LINK"),
});

/** 退订立即生效 */
export const POST = withErrorHandler(async (request) => {
  const body = await request.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return createErrorResponse("参数错误", ErrorCode.VALIDATION_ERROR, 400);
  }
  if (parsed.data.scope === "EVENT" && !parsed.data.event_id) {
    return createErrorResponse("活动退订需 event_id", ErrorCode.VALIDATION_ERROR, 400);
  }

  const row = await addOptOut({
    identityType: parsed.data.identity_type,
    identityValue: parsed.data.identity_value,
    scope: parsed.data.scope,
    eventId: parsed.data.event_id,
    source: parsed.data.source,
  });

  return createSuccessResponse({ ok: true, id: row.id });
});
