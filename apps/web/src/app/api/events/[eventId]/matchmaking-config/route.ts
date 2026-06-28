import { ErrorCode } from "@connectiq/types";
import { z } from "zod";
import {
  createErrorResponse,
  createSuccessResponse,
  requireEventAccess,
  withErrorHandler,
} from "@/lib/api-auth";
import {
  getMatchmakingConfig,
  updateMatchmakingConfig,
} from "@/lib/matchmaking-config-service";
import { assertAttendeeReadableEvent } from "@/lib/public-event-access";

const intentFieldSchema = z.object({
  enabled: z.boolean().optional(),
  allow_custom: z.boolean().optional(),
});

const patchSchema = z
  .object({
    intent_config: z
      .object({
        supply: intentFieldSchema.optional(),
        demand: intentFieldSchema.optional(),
        role: intentFieldSchema
          .extend({ options: z.array(z.string().min(1)).optional() })
          .optional(),
        topics: intentFieldSchema.optional(),
        premeet_days_before: z.number().int().min(0).max(90).optional(),
        premeet_reminder_enabled: z.boolean().optional(),
        premeet_reminder_days: z.number().int().min(0).max(30).optional(),
        premeet_reminder_message: z.string().max(500).optional(),
      })
      .optional(),
    premeet_enabled: z.boolean().optional(),
    premeet_open_at: z.string().datetime().nullable().optional(),
    premeet_days_before: z.number().int().min(0).max(90).optional(),
  })
  .partial();

export const GET = withErrorHandler(async (_request, context) => {
  const eventId = context?.params?.eventId;
  if (!eventId) {
    return createErrorResponse("缺少活动 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  await assertAttendeeReadableEvent(eventId);
  const config = await getMatchmakingConfig(eventId);
  return createSuccessResponse(config);
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

  const config = await updateMatchmakingConfig(eventId, {
    ...parsed.data,
    intent_config: parsed.data.intent_config as Parameters<
      typeof updateMatchmakingConfig
    >[1]["intent_config"],
  });
  return createSuccessResponse(config);
});
