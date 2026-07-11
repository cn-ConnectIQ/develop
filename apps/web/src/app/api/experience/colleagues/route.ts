import { ErrorCode } from "@connectiq/types";
import { z } from "zod";
import {
  createErrorResponse,
  createSuccessResponse,
  requireAccountAdmin,
  withErrorHandler,
} from "@/lib/api-auth";
import {
  ExperienceAccountError,
  inviteExperienceColleague,
} from "@/lib/experience/experience-account-service";

const bodySchema = z.object({
  phone: z.string().regex(/^1[3-9]\d{9}$/, "请输入有效手机号"),
  contactName: z.string().min(1).max(40).optional(),
});

export const POST = withErrorHandler(async (request) => {
  const auth = await requireAccountAdmin();
  if ("error" in auth) return auth.error;

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
    const result = await inviteExperienceColleague(
      auth.session.user.id,
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
