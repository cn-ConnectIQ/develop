import { z } from "zod";
import {
  cacheGet,
  cacheSet,
  cacheTtl,
} from "@/lib/redis";
import {
  generateSmsCode,
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
    await sendVerificationSms(phone, code);

    const exposeDevCode = !process.env.ALIYUN_SMS_ACCESS_KEY;
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
