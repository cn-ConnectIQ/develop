import { ErrorCode } from "@connectiq/types";
import { prisma } from "@connectiq/database";
import {
  ApiError,
  createErrorResponse,
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api-auth";
import { resolveMobileUserId } from "@/lib/mobile-user-id";
import { submitAiFeedback } from "@/lib/ai-feedback-service";


export const POST = withErrorHandler(async (request) => {
  const userId = await resolveMobileUserId(request);
  const body = (await request.json()) as {
    feedback_type?: string;
    reference_table?: "FEED_ITEM" | "AI_MATCH_RESULT";
    reference_id?: string;
    reason_tags?: string[];
    free_text?: string;
    feed_type?: string;
    mute_person_month?: boolean;
  };

  if (!body.reference_id) {
    return createErrorResponse("缺少 reference_id", ErrorCode.VALIDATION_ERROR, 400);
  }
  if (!Array.isArray(body.reason_tags) || body.reason_tags.length === 0) {
    return createErrorResponse("请选择反馈原因", ErrorCode.VALIDATION_ERROR, 400);
  }

  const result = await submitAiFeedback(userId, {
    feedback_type: body.feedback_type ?? "MATCH_USELESS",
    reference_table: body.reference_table ?? "FEED_ITEM",
    reference_id: body.reference_id,
    reason_tags: body.reason_tags,
    free_text: body.free_text,
    feed_type: body.feed_type,
    mute_person_month: body.mute_person_month,
  });

  return createSuccessResponse(result);
});
