import { IntentCategory, IntentTagPool } from "@connectiq/database";
import { ErrorCode } from "@connectiq/types";
import { z } from "zod";
import {
  createErrorResponse,
  createSuccessResponse,
  requireEventAccess,
  withErrorHandler,
} from "@/lib/api-auth";
import {
  copyPlatformTagsToEvent,
  createIntentTag,
  listEventIntentTags,
  syncEventIntentTags,
} from "@/lib/intent-tag-service";

const createSchema = z.object({
  label: z.string().min(1).max(80),
  slug: z.string().optional(),
  category: z.nativeEnum(IntentCategory).optional(),
  pool: z.nativeEnum(IntentTagPool).optional(),
  color: z.string().optional(),
  sortOrder: z.number().optional(),
});

const copySchema = z.object({
  action: z.literal("copy_platform"),
  tagIds: z.array(z.string()).optional(),
});

const patchSchema = z.object({
  upsert: z
    .array(
      z.object({
        id: z.string().optional(),
        label: z.string().min(1).max(80),
        slug: z.string().optional(),
        pool: z.nativeEnum(IntentTagPool).optional(),
        color: z.string().nullable().optional(),
        sortOrder: z.number().optional(),
      }),
    )
    .optional(),
  delete_ids: z.array(z.string()).optional(),
});

export const GET = withErrorHandler(async (_request, context) => {
  const eventId = context?.params?.eventId;
  if (!eventId) {
    return createErrorResponse("缺少活动 ID", ErrorCode.VALIDATION_ERROR, 400);
  }
  await requireEventAccess(eventId);
  const tags = await listEventIntentTags(eventId);
  return createSuccessResponse({ tags });
});

export const POST = withErrorHandler(async (request, context) => {
  const eventId = context?.params?.eventId;
  if (!eventId) {
    return createErrorResponse("缺少活动 ID", ErrorCode.VALIDATION_ERROR, 400);
  }
  await requireEventAccess(eventId);

  const body = await request.json();
  const copyParsed = copySchema.safeParse(body);
  if (copyParsed.success) {
    const result = await copyPlatformTagsToEvent(
      eventId,
      copyParsed.data.tagIds,
    );
    return createSuccessResponse(result);
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return createErrorResponse("参数错误", ErrorCode.VALIDATION_ERROR, 400);
  }
  const tag = await createIntentTag({
    eventId,
    label: parsed.data.label,
    slug: parsed.data.slug,
    category: parsed.data.category,
    pool: parsed.data.pool,
    color: parsed.data.color,
    sortOrder: parsed.data.sortOrder,
  });
  return createSuccessResponse(tag);
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

  if (!parsed.data.upsert?.length && !parsed.data.delete_ids?.length) {
    return createErrorResponse("无有效更新", ErrorCode.VALIDATION_ERROR, 400);
  }

  const tags = await syncEventIntentTags(eventId, {
    upsert: (parsed.data.upsert ?? []).map((t) => ({
      id: t.id,
      label: t.label,
      slug: t.slug,
      pool: t.pool,
      color: t.color,
      sortOrder: t.sortOrder,
    })),
    delete_ids: parsed.data.delete_ids,
  });
  return createSuccessResponse({ tags });
});
