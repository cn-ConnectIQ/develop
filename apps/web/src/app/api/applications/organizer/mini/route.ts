import { ErrorCode } from "@connectiq/types";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api-auth";
import { resolveMobileUserId } from "@/lib/mobile-user-id";
import {
  ApplicationServiceError,
  submitMiniTrialApplication,
} from "@/lib/organizer-application-service";

const bodySchema = z.object({
  contactName: z.string().trim().min(2, "请输入联系人姓名").max(50),
  orgName: z.string().trim().min(2, "请输入组织/公司名称").max(100),
  contactPhone: z
    .string()
    .trim()
    .regex(/^1[3-9]\d{9}$/, "请输入有效的中国大陆手机号"),
  wechat: z
    .string()
    .trim()
    .max(64, "微信号过长")
    .optional()
    .nullable()
    .transform((v) => v || null),
  requirement: z
    .string()
    .trim()
    .max(2000, "活动规模/需求过长")
    .optional()
    .nullable()
    .transform((v) => v || null),
});

/**
 * 小程序「申请试用」→ 平台待审正式账号申请
 * POST /api/applications/organizer/mini
 * 鉴权：Authorization Bearer mini_*
 */
export const POST = withErrorHandler(async (request) => {
  const userId = await resolveMobileUserId(request);
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
    const result = await submitMiniTrialApplication({
      userId,
      contactName: parsed.data.contactName,
      orgName: parsed.data.orgName,
      contactPhone: parsed.data.contactPhone,
      wechat: parsed.data.wechat,
      requirement: parsed.data.requirement,
    });
    return createSuccessResponse(result.application);
  } catch (error) {
    if (error instanceof ApplicationServiceError) {
      if (error.code === "DUPLICATE_APPLICATION") {
        return NextResponse.json(
          { error: error.message, code: "DUPLICATE_APPLICATION" },
          { status: 400 },
        );
      }
      if (error.code === "PHONE_MISMATCH") {
        return createErrorResponse(
          error.message,
          ErrorCode.VALIDATION_ERROR,
          400,
        );
      }
      if (error.code === "USER_NOT_FOUND") {
        return createErrorResponse(error.message, ErrorCode.NOT_FOUND, 404);
      }
      return createErrorResponse(
        error.message,
        ErrorCode.VALIDATION_ERROR,
        400,
      );
    }
    throw error;
  }
});
