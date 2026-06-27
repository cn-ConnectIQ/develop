import { ErrorCode } from "@connectiq/types";
import { z } from "zod";
import { prisma } from "@connectiq/database";
import {
  ApiError,
  createErrorResponse,
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api-auth";
import { resolveMobileUserId } from "@/lib/mobile-user-id";
import { recordFeedFeedback } from "@/lib/feed-service";


const feedbackBodySchema = z.object({
  reasons: z.array(z.string()).min(1),
  feed_type: z.string().optional(),
});

export const POST = withErrorHandler(async (request, context) => {
  const id = context?.params?.id;
  if (!id) {
    return createErrorResponse("缺少 Feed ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  const userId = await resolveMobileUserId(request);
  const body = feedbackBodySchema.safeParse(await request.json());
  if (!body.success) {
    return createErrorResponse("请选择反馈原因", ErrorCode.VALIDATION_ERROR, 400);
  }

  const ok = await recordFeedFeedback(
    userId,
    id,
    body.data.reasons,
    body.data.feed_type,
  );

  if (!ok) {
    return createErrorResponse("动态不存在", ErrorCode.NOT_FOUND, 404);
  }

  return createSuccessResponse({ ok: true });
});
