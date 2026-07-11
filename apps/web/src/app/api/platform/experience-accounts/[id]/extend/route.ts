import { ErrorCode } from "@connectiq/types";
import { z } from "zod";
import {
  createErrorResponse,
  createSuccessResponse,
  requirePlatformAdmin,
  withErrorHandler,
} from "@/lib/api-auth";
import { EXPERIENCE_DEFAULT_EXTEND_DAYS } from "@/lib/experience/experience-config";
import {
  ExperienceAccountError,
  extendExperienceAccount,
} from "@/lib/experience/experience-account-service";

const bodySchema = z.object({
  days: z.number().int().min(1).max(90).default(EXPERIENCE_DEFAULT_EXTEND_DAYS),
  notes: z.string().max(500).optional(),
});

export const POST = withErrorHandler(async (request, context) => {
  const { session } = await requirePlatformAdmin();

  const id = context?.params?.id;
  if (!id) {
    return createErrorResponse("缺少体验账号 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  const body = await request.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return createErrorResponse("参数错误", ErrorCode.VALIDATION_ERROR, 400);
  }

  try {
    const updated = await extendExperienceAccount(
      id,
      session.user.id,
      parsed.data.days,
      parsed.data.notes,
    );
    return createSuccessResponse({
      id: updated.id,
      status: updated.status,
      expiresAt: updated.expiresAt.toISOString(),
      extendedCount: updated.extendedCount,
    });
  } catch (error) {
    if (error instanceof ExperienceAccountError) {
      return createErrorResponse(error.message, ErrorCode.VALIDATION_ERROR, 400);
    }
    throw error;
  }
});
