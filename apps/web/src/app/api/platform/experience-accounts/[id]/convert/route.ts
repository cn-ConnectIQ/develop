import { ErrorCode } from "@connectiq/types";
import { z } from "zod";
import {
  createErrorResponse,
  createSuccessResponse,
  requirePlatformAdmin,
  withErrorHandler,
} from "@/lib/api-auth";
import {
  convertExperienceAccountToFormal,
  ExperienceAccountError,
} from "@/lib/experience/experience-account-service";

const bodySchema = z.object({
  orgName: z.string().min(2, "组织名称至少 2 个字符").max(80),
  notes: z.string().max(500).optional(),
});

export const POST = withErrorHandler(async (request, context) => {
  const { session } = await requirePlatformAdmin();

  const id = context?.params?.id;
  if (!id) {
    return createErrorResponse("缺少体验账号 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  const body = await request.json();
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return createErrorResponse(
      parsed.error.issues[0]?.message ?? "参数错误",
      ErrorCode.VALIDATION_ERROR,
      400,
    );
  }

  try {
    const result = await convertExperienceAccountToFormal(
      id,
      session.user.id,
      parsed.data,
    );
    return createSuccessResponse(result);
  } catch (error) {
    if (error instanceof ExperienceAccountError) {
      return createErrorResponse(error.message, ErrorCode.VALIDATION_ERROR, 400);
    }
    throw error;
  }
});
