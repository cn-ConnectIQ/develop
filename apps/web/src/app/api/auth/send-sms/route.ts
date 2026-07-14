import { z } from "zod";
import { cacheSet, cacheTtl } from "@/lib/redis";
import {
  generateSmsCode,
  isSmsConfigured,
  resolveSmsProvider,
  smsRateKey,
  smsVerifyKey,
  SMS_CODE_TTL,
  SMS_RATE_LIMIT,
} from "@/lib/sms";
import { notifyVerificationSms } from "@/lib/notification/notification-service";
import { createErrorResponse, createSuccessResponse } from "@/lib/api-auth";
import { ErrorCode } from "@connectiq/types";

const phoneSchema = z.object({
  phone: z
    .string()
    .regex(/^1[3-9]\d{9}$/, "请输入有效的中国大陆手机号"),
});

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
    await cacheSet(smsVerifyKey(phone), code, SMS_CODE_TTL);
    await cacheSet(smsRateKey(phone), "1", SMS_RATE_LIMIT);

    // SYS-01：经 Notification SmsAdapter；有赛邮验证码模板则走 XSend 通道
    const project = process.env.SUBMAIL_PROJECT_CODE?.trim();
    if (resolveSmsProvider() === "submail" && project) {
      const { sendSubmailXSend } = await import("@/lib/submail-sms");
      const result = await sendSubmailXSend({
        phone,
        project,
        vars: { code },
      });
      if (!result.success) {
        return createErrorResponse(
          result.error ?? "发送验证码失败",
          ErrorCode.INTERNAL_ERROR,
          500,
        );
      }
    } else {
      const result = await notifyVerificationSms({
        phone,
        code,
        eventId: "system",
      });
      if (!result.success) {
        return createErrorResponse(
          result.error ?? "发送验证码失败",
          ErrorCode.INTERNAL_ERROR,
          500,
        );
      }
    }

    const exposeDevCode = !isSmsConfigured();
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
