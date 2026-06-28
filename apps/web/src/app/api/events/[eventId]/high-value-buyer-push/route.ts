import { ErrorCode } from "@connectiq/types";
import { z } from "zod";
import {
  createErrorResponse,
  createSuccessResponse,
  requireEventAccess,
  withErrorHandler,
} from "@/lib/api-auth";
import {
  getHighValueBuyerPushConfig,
  parseHighValueBuyerPushConfig,
  saveHighValueBuyerPushConfig,
} from "@/lib/high-value-buyer-push-config";

export const GET = withErrorHandler(async (_request, context) => {
  const eventId = context?.params?.eventId;
  if (!eventId) {
    return createErrorResponse("缺少活动 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  await requireEventAccess(eventId);
  const config = await getHighValueBuyerPushConfig(eventId);
  return createSuccessResponse({ config });
});

const patchSchema = z.object({
  a_level_on_lead_capture: z.boolean().optional(),
  b_level_scan_threshold: z.number().int().min(2).max(10).optional(),
  cooldown_minutes: z.number().int().min(15).max(1440).optional(),
  notify_exhibitor: z.boolean().optional(),
  notify_feed: z.boolean().optional(),
});

export const PATCH = withErrorHandler(async (request, context) => {
  const eventId = context?.params?.eventId;
  if (!eventId) {
    return createErrorResponse("缺少活动 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  await requireEventAccess(eventId);

  const body = await request.json().catch(() => ({}));
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return createErrorResponse("参数错误", ErrorCode.VALIDATION_ERROR, 400);
  }

  const current = await getHighValueBuyerPushConfig(eventId);
  const next = parseHighValueBuyerPushConfig({ ...current, ...parsed.data });
  const saved = await saveHighValueBuyerPushConfig(eventId, next);
  return createSuccessResponse({ config: saved });
});
