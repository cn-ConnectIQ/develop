import { SnSessionStatus } from "@connectiq/database";
import { ErrorCode } from "@connectiq/types";
import { z } from "zod";
import {
  createErrorResponse,
  createSuccessResponse,
  requireEventAccess,
  withErrorHandler,
} from "@/lib/api-auth";
import { guardEventFeature } from "@/lib/event-feature-flag-guard";
import { updateEventSnSession } from "@/lib/sn-sessions-service";

const patchSchema = z.object({
  status: z.nativeEnum(SnSessionStatus).optional(),
  round_count: z.number().int().min(1).max(20).optional(),
});

export const PATCH = withErrorHandler(async (request, context) => {
  const eventId = context?.params?.eventId;
  const sessionId = context?.params?.sessionId;
  if (!eventId || !sessionId) {
    return createErrorResponse("参数缺失", ErrorCode.VALIDATION_ERROR, 400);
  }

  await requireEventAccess(eventId);
  const disabled = await guardEventFeature(eventId, "speedNetworking");
  if (disabled) return disabled;
  const body = await request.json().catch(() => ({}));
  const parsed = patchSchema.safeParse(body);

  if (!parsed.success) {
    return createErrorResponse(
      parsed.error.issues[0]?.message ?? "参数错误",
      ErrorCode.VALIDATION_ERROR,
      400,
    );
  }

  if (!parsed.data.status && parsed.data.round_count === undefined) {
    return createErrorResponse("缺少更新字段", ErrorCode.VALIDATION_ERROR, 400);
  }

  const session = await updateEventSnSession(eventId, sessionId, parsed.data);
  return createSuccessResponse(session);
});
