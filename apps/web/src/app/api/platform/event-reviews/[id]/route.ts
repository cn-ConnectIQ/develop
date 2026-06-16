import { ErrorCode } from "@connectiq/types";
import { z } from "zod";
import {
  createErrorResponse,
  createSuccessResponse,
  requirePlatformAdmin,
  withErrorHandler,
} from "@/lib/api-auth";
import { reviewPlatformEvent } from "@/lib/platform-event-review-service";

const reviewSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED", "REVISION_REQUIRED"]),
  reviewer_notes: z.string().optional(),
  feedback: z.string().optional(),
});

export const PATCH = withErrorHandler(async (request, context) => {
  const { session } = await requirePlatformAdmin();
  const id = context?.params?.id;
  if (!id) {
    return createErrorResponse("缺少审核 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  const body = await request.json();
  const parsed = reviewSchema.safeParse(body);
  if (!parsed.success) {
    return createErrorResponse(
      parsed.error.issues[0]?.message ?? "参数错误",
      ErrorCode.VALIDATION_ERROR,
      400,
    );
  }

  try {
    const result = await reviewPlatformEvent(id, session.user.id, {
      status: parsed.data.status,
      reviewerNotes: parsed.data.reviewer_notes,
      feedback: parsed.data.feedback,
    });
    return createSuccessResponse(result);
  } catch {
    return createErrorResponse("审核记录不存在", ErrorCode.NOT_FOUND, 404);
  }
});
