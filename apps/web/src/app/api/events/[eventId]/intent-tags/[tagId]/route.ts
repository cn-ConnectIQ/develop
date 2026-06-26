import { IntentCategory, IntentTagPool } from "@connectiq/database";
import { ErrorCode } from "@connectiq/types";
import { z } from "zod";
import {
  createErrorResponse,
  createSuccessResponse,
  requireEventAccess,
  withErrorHandler,
} from "@/lib/api-auth";
import { deleteIntentTag, updateIntentTag } from "@/lib/intent-tag-service";

const patchSchema = z.object({
  label: z.string().min(1).max(80).optional(),
  category: z.nativeEnum(IntentCategory).nullable().optional(),
  pool: z.nativeEnum(IntentTagPool).optional(),
  color: z.string().nullable().optional(),
  sortOrder: z.number().optional(),
});

export const PATCH = withErrorHandler(async (request, context) => {
  const eventId = context?.params?.eventId;
  const tagId = context?.params?.tagId;
  if (!eventId || !tagId) {
    return createErrorResponse("参数缺失", ErrorCode.VALIDATION_ERROR, 400);
  }
  await requireEventAccess(eventId);
  const body = await request.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return createErrorResponse("参数错误", ErrorCode.VALIDATION_ERROR, 400);
  }
  const tag = await updateIntentTag(tagId, parsed.data, { eventId });
  return createSuccessResponse(tag);
});

export const DELETE = withErrorHandler(async (_request, context) => {
  const eventId = context?.params?.eventId;
  const tagId = context?.params?.tagId;
  if (!eventId || !tagId) {
    return createErrorResponse("参数缺失", ErrorCode.VALIDATION_ERROR, 400);
  }
  await requireEventAccess(eventId);
  await deleteIntentTag(tagId, { eventId });
  return createSuccessResponse({ ok: true });
});
