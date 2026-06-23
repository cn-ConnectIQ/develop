import { IntentCategory } from "@connectiq/database";
import { ErrorCode } from "@connectiq/types";
import { z } from "zod";
import {
  createErrorResponse,
  createSuccessResponse,
  requirePlatformAdmin,
  withErrorHandler,
} from "@/lib/api-auth";
import { deleteIntentTag, updateIntentTag } from "@/lib/intent-tag-service";

const patchSchema = z.object({
  label: z.string().min(1).max(80).optional(),
  category: z.nativeEnum(IntentCategory).nullable().optional(),
  color: z.string().nullable().optional(),
  sortOrder: z.number().optional(),
});

export const PATCH = withErrorHandler(async (request, context) => {
  await requirePlatformAdmin();
  const tagId = context?.params?.tagId;
  if (!tagId) {
    return createErrorResponse("缺少标签 ID", ErrorCode.VALIDATION_ERROR, 400);
  }
  const body = await request.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return createErrorResponse("参数错误", ErrorCode.VALIDATION_ERROR, 400);
  }
  const tag = await updateIntentTag(tagId, parsed.data, { eventId: null });
  return createSuccessResponse(tag);
});

export const DELETE = withErrorHandler(async (_request, context) => {
  await requirePlatformAdmin();
  const tagId = context?.params?.tagId;
  if (!tagId) {
    return createErrorResponse("缺少标签 ID", ErrorCode.VALIDATION_ERROR, 400);
  }
  await deleteIntentTag(tagId, { eventId: null });
  return createSuccessResponse({ ok: true });
});
