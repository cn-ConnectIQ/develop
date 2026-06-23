import { IntentCategory } from "@connectiq/database";
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
} from "@/lib/intent-tag-service";

const createSchema = z.object({
  label: z.string().min(1).max(80),
  slug: z.string().optional(),
  category: z.nativeEnum(IntentCategory).optional(),
  color: z.string().optional(),
  sortOrder: z.number().optional(),
});

const copySchema = z.object({
  action: z.literal("copy_platform"),
  tagIds: z.array(z.string()).optional(),
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
  const tag = await createIntentTag({ ...parsed.data, eventId });
  return createSuccessResponse(tag);
});
