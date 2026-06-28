import { ErrorCode } from "@connectiq/types";
import { z } from "zod";
import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api-auth";
import {
  createOrganizerTrialSignup,
  OrganizerSignupError,
} from "@/lib/organizer-signup-service";

const bodySchema = z.object({
  phone: z.string().regex(/^1[3-9]\d{9}$/, "请输入有效手机号"),
  code: z.string().length(6, "请输入 6 位验证码"),
  companyName: z.string().min(2, "企业名称至少 2 个字符").max(80),
  contactName: z.string().min(1).max(40).optional(),
  signupSource: z.string().max(64).optional(),
});

export const POST = withErrorHandler(async (request) => {
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
    const result = await createOrganizerTrialSignup(parsed.data);
    return createSuccessResponse(result);
  } catch (error) {
    if (error instanceof OrganizerSignupError) {
      const status =
        error.code === "ALREADY_REGISTERED" ||
        error.code === "PENDING_APPLICATION"
          ? 409
          : 400;
      return createErrorResponse(error.message, ErrorCode.VALIDATION_ERROR, status);
    }
    throw error;
  }
});
