import { ErrorCode } from "@connectiq/types";
import { z } from "zod";
import {
  ApiError,
  createErrorResponse,
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api-auth";
import { resolveMobileUserId } from "@/lib/mobile-user-id";
import { markFeedItemRead } from "@/lib/feed-service";
import { prisma } from "@connectiq/database";


const patchBodySchema = z.object({
  is_read: z.boolean().optional(),
});

export const PATCH = withErrorHandler(async (request, context) => {
  const id = context?.params?.id;
  if (!id) {
    return createErrorResponse("缺少 Feed ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  const userId = await resolveMobileUserId(request);
  const body = patchBodySchema.safeParse(await request.json());
  if (!body.success) {
    return createErrorResponse("参数无效", ErrorCode.VALIDATION_ERROR, 400);
  }

  if (body.data.is_read) {
    const updated = await markFeedItemRead(userId, id);
    if (!updated) {
      return createErrorResponse("动态不存在", ErrorCode.NOT_FOUND, 404);
    }
    return createSuccessResponse(updated);
  }

  return createSuccessResponse({ id, ok: true });
});
