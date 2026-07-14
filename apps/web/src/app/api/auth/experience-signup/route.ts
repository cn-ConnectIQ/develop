import { ErrorCode } from "@connectiq/types";
import { z } from "zod";
import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api-auth";
import {
  createExperienceSignup,
  ExperienceAccountError,
} from "@/lib/experience/experience-account-service";

const bodySchema = z.object({
  phone: z.string().regex(/^1[3-9]\d{9}$/, "请输入有效手机号"),
  code: z.string().length(6, "请输入 6 位验证码"),
  contactName: z.string().min(1, "请输入姓名").max(40),
  companyName: z.string().min(2, "请填写公司名称").max(80),
  email: z.string().email("请输入有效邮箱"),
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
    const result = await createExperienceSignup(parsed.data);
    return createSuccessResponse(result);
  } catch (error) {
    if (error instanceof ExperienceAccountError) {
      const status =
        error.code === "ALREADY_ACTIVE" ||
        error.code === "ALREADY_CONVERTED" ||
        error.code === "ALREADY_FORMAL" ||
        error.code === "PENDING_APPLICATION" ||
        error.code === "EMAIL_TAKEN"
          ? 409
          : 400;
      return createErrorResponse(error.message, ErrorCode.VALIDATION_ERROR, status);
    }
    throw error;
  }
});
