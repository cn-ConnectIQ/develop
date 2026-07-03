import { IntentCategory, IntentTagPool } from "@connectiq/database";
import { ErrorCode } from "@connectiq/types";
import { z } from "zod";
import {
  createErrorResponse,
  createSuccessResponse,
  requireEventAccess,
  requireEventAccessCheck,
  withErrorHandler,
  ApiError,
} from "@/lib/api-auth";
import {
  copyPlatformTagsToEvent,
  createIntentTag,
  syncEventIntentTags,
} from "@/lib/intent-tag-service";
import {
  getEventIntentTagLibrary,
  saveEventIntentTagLibrary,
} from "@/lib/intent-tag-library";
import { resolveMobileUserId } from "@/lib/mobile-user-id";
import { prisma } from "@connectiq/database";

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

const bulkSaveSchema = z.object({
  supply: z.array(z.string().max(80)).max(100),
  demand: z.array(z.string().max(80)).max(100),
  roles: z.array(z.string().max(80)).max(30),
  topics: z.array(z.string().max(80)).max(100),
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

async function assertIntentTagLibraryReadAccess(
  request: Request,
  eventId: string,
) {
  const organizer = await requireEventAccessCheck(eventId);
  if (!("error" in organizer)) return;

  await resolveMobileUserId(request);

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true },
  });
  if (!event) {
    throw new ApiError("活动不存在", ErrorCode.NOT_FOUND, 404);
  }
}

export const GET = withErrorHandler(async (request, context) => {
  const eventId = context?.params?.eventId;
  if (!eventId) {
    return createErrorResponse("缺少活动 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  await assertIntentTagLibraryReadAccess(request, eventId);

  const library = await getEventIntentTagLibrary(eventId);
  return createSuccessResponse(library);
});

export const POST = withErrorHandler(async (request, context) => {
  const eventId = context?.params?.eventId;
  if (!eventId) {
    return createErrorResponse("缺少活动 ID", ErrorCode.VALIDATION_ERROR, 400);
  }
  await requireEventAccess(eventId);

  const body = await request.json();

  const bulkParsed = bulkSaveSchema.safeParse(body);
  if (bulkParsed.success) {
    const library = await saveEventIntentTagLibrary(eventId, bulkParsed.data);
    return createSuccessResponse(library);
  }

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

  await syncEventIntentTags(eventId, {
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

  const library = await getEventIntentTagLibrary(eventId);
  return createSuccessResponse(library);
});
