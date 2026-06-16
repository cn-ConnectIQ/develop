import { AccountType } from "@connectiq/database";
import { ErrorCode } from "@connectiq/types";
import { z } from "zod";
import {
  createErrorResponse,
  createSuccessResponse,
  requireAuthSession,
  withErrorHandler,
} from "@/lib/api-auth";
import {
  ApplicationServiceError,
  submitOrganizerApplication,
} from "@/lib/organizer-application-service";

const submitSchema = z.object({
  phone: z
    .string()
    .regex(/^1[3-9]\d{9}$/, "请输入有效的中国大陆手机号")
    .optional(),
  code: z.string().length(6, "请输入 6 位验证码").optional(),
  email: z.string().email("请输入有效邮箱"),
  accountType: z.nativeEnum(AccountType),
  orgName: z.string().min(2, "请输入组织/公司名称").max(100),
  orgCreditCode: z
    .string()
    .optional()
    .transform((v) => v?.trim() || undefined)
    .refine(
      (v) =>
        !v ||
        /^[0-9A-HJ-NPQRTUWXY]{2}\d{6}[0-9A-HJ-NPQRTUWXY]{10}$/.test(v),
      "请输入 18 位统一社会信用代码",
    ),
  orgWebsite: z
    .string()
    .optional()
    .transform((v) => v?.trim() || undefined)
    .refine(
      (v) => !v || /^https?:\/\/.+/.test(v),
      "请输入有效官网地址",
    ),
  contactName: z.string().min(2, "请输入联系人姓名").max(50),
  contactEmail: z.string().email("请输入有效联系邮箱"),
  contactPhone: z
    .string()
    .regex(/^1[3-9]\d{9}$/, "请输入有效的联系手机"),
  description: z
    .string()
    .min(100, "申请说明至少 100 字")
    .max(500, "申请说明最多 500 字"),
});

export const POST = withErrorHandler(async (request) => {
  const body = await request.json();
  const parsed = submitSchema.safeParse(body);
  if (!parsed.success) {
    return createErrorResponse(
      parsed.error.issues[0]?.message ?? "参数错误",
      ErrorCode.VALIDATION_ERROR,
      400,
    );
  }

  const session = await requireAuthSession();
  const data = parsed.data;

  if (!session && (!data.phone || !data.code)) {
    return createErrorResponse(
      "请先验证手机号或登录后再提交",
      ErrorCode.VALIDATION_ERROR,
      400,
    );
  }

  try {
    const result = await submitOrganizerApplication({
      userId: session?.user.id,
      phone: data.phone,
      code: data.code,
      email: data.email,
      accountType: data.accountType,
      orgName: data.orgName,
      orgCreditCode: data.orgCreditCode || null,
      orgWebsite: data.orgWebsite || null,
      contactName: data.contactName,
      contactEmail: data.contactEmail,
      contactPhone: data.contactPhone,
      description: data.description,
    });

    return createSuccessResponse(result.application);
  } catch (error) {
    if (error instanceof ApplicationServiceError) {
      const status =
        error.code === "ALREADY_APPROVED"
          ? 409
          : error.code === "INVALID_CODE" || error.code === "PHONE_REQUIRED"
            ? 400
            : 400;
      return createErrorResponse(error.message, ErrorCode.VALIDATION_ERROR, status);
    }
    throw error;
  }
});
