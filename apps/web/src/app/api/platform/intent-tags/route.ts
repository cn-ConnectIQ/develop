import { IntentCategory } from "@connectiq/database";
import { ErrorCode } from "@connectiq/types";
import { z } from "zod";
import {
  createErrorResponse,
  createSuccessResponse,
  requirePlatformAdmin,
  withErrorHandler,
} from "@/lib/api-auth";
import {
  createIntentTag,
  listPlatformIntentTags,
} from "@/lib/intent-tag-service";

const createSchema = z.object({
  label: z.string().min(1).max(80),
  slug: z.string().optional(),
  category: z.nativeEnum(IntentCategory).optional(),
  color: z.string().optional(),
  sortOrder: z.number().optional(),
});

export const GET = withErrorHandler(async () => {
  await requirePlatformAdmin();
  const tags = await listPlatformIntentTags();
  return createSuccessResponse({ tags });
});

export const POST = withErrorHandler(async (request) => {
  await requirePlatformAdmin();
  const body = await request.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return createErrorResponse(
      parsed.error.issues[0]?.message ?? "参数错误",
      ErrorCode.VALIDATION_ERROR,
      400,
    );
  }
  const tag = await createIntentTag({ ...parsed.data, eventId: null });
  return createSuccessResponse(tag);
});
