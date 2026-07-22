import { z } from "zod";
import { cacheSet, cacheTtl } from "@/lib/redis";
import {
  generateSmsCode,
  isSmsConfigured,
  sendVerificationSms,
  smsRateKey,
  smsVerifyKey,
  SMS_CODE_TTL,
  SMS_RATE_LIMIT,
} from "@/lib/sms";
import { createErrorResponse, createSuccessResponse } from "@/lib/api-auth";
import { ErrorCode } from "@connectiq/types";

const phoneSchema = z.object({
  phone: z
    .string()
    .regex(/^1[3-9]\d{9}$/, "请输入有效的中国大陆手机号"),
});

/**
 * 登录 / 注册验证码：必须在请求内同步直发通道，
 * 禁止走 NotificationJob / invite 队列 / cron。
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = phoneSchema.safeParse(body);
    if (!parsed.success) {
      return createErrorResponse(
        parsed.error.issues[0]?.message ?? "手机号格式错误",
        ErrorCode.VALIDATION_ERROR,
        400,
      );
    }

    const { phone } = parsed.data;
    const rateTtl = await cacheTtl(smsRateKey(phone));
    if (rateTtl > 0) {
      return createErrorResponse(
        `请 ${rateTtl} 秒后再试`,
        ErrorCode.VALIDATION_ERROR,
        429,
      );
    }

    const code = generateSmsCode();
    await Promise.all([
      cacheSet(smsVerifyKey(phone), code, SMS_CODE_TTL),
      cacheSet(smsRateKey(phone), "1", SMS_RATE_LIMIT),
    ]);

    const result = await sendVerificationSms(phone, code);
    if (!result.sent) {
      return createErrorResponse(
        result.error ?? "发送验证码失败",
        ErrorCode.INTERNAL_ERROR,
        500,
      );
    }

    const exposeDevCode = !isSmsConfigured() || Boolean(result.dev);
    return createSuccessResponse({
      sent: true,
      ...(exposeDevCode ? { devCode: code } : {}),
    });
  } catch (error) {
    console.error(error);
    return createErrorResponse(
      "发送验证码失败",
      ErrorCode.INTERNAL_ERROR,
      500,
    );
  }
}
