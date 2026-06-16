import { ErrorCode } from "@connectiq/types";
import { z } from "zod";
import {
  createErrorResponse,
  createSuccessResponse,
  requirePlatformAdmin,
  withErrorHandler,
} from "@/lib/api-auth";
import {
  PlatformApplicationError,
  reviewPlatformApplication,
} from "@/lib/platform-application-service";

const reviewSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED", "REVISION_REQUIRED"]),
  reviewer_notes: z.string().optional(),
  rejection_reason: z.string().optional(),
});

export const PATCH = withErrorHandler(async (request, context) => {
  const { session } = await requirePlatformAdmin();
  const id = context?.params?.id;
  if (!id) {
    return createErrorResponse("缺少申请 ID", ErrorCode.VALIDATION_ERROR, 400);
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

  if (
    (parsed.data.status === "REJECTED" ||
      parsed.data.status === "REVISION_REQUIRED") &&
    !parsed.data.rejection_reason?.trim()
  ) {
    return createErrorResponse(
      "拒绝或要求修改时需填写原因",
      ErrorCode.VALIDATION_ERROR,
      400,
    );
  }

  try {
    const result = await reviewPlatformApplication(id, session.user.id, {
      status: parsed.data.status,
      reviewerNotes: parsed.data.reviewer_notes,
      rejectionReason: parsed.data.rejection_reason,
    });
    return createSuccessResponse(result);
  } catch (error) {
    if (error instanceof PlatformApplicationError) {
      const status =
        error.code === "NOT_FOUND"
          ? 404
          : error.code === "ALREADY_REVIEWED"
            ? 409
            : 400;
      return createErrorResponse(error.message, ErrorCode.VALIDATION_ERROR, status);
    }
    throw error;
  }
});
