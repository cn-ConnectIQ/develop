import { z } from "zod";
import { prisma } from "@connectiq/database";
import { ErrorCode } from "@connectiq/types";
import { createErrorResponse, createSuccessResponse } from "@/lib/api-auth";
import {
  EMAIL_CODE_RATE_LIMIT,
  EMAIL_CODE_TTL,
  emailRateKey,
  emailVerifyKey,
  generateEmailCode,
  sendLoginEmailCode,
} from "@/lib/email-otp";
import { cacheSet, cacheTtl } from "@/lib/redis";

const schema = z.object({
  email: z.string().email("请输入有效邮箱"),
});

export async function POST(request: Request) {
  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return createErrorResponse(
        parsed.error.issues[0]?.message ?? "邮箱格式错误",
        ErrorCode.VALIDATION_ERROR,
        400,
      );
    }

    const email = parsed.data.email.trim().toLowerCase();
    const rateTtl = await cacheTtl(emailRateKey(email));
    if (rateTtl > 0) {
      return createErrorResponse(
        `请 ${rateTtl} 秒后再试`,
        ErrorCode.VALIDATION_ERROR,
        429,
      );
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (!user) {
      // 不暴露是否存在账号；避免前端误以为已发信
      console.info(`[send-email-code] skip unknown email (no send): ${email}`);
      return createSuccessResponse({ sent: true });
    }

    const code = generateEmailCode();
    await cacheSet(emailVerifyKey(email), code, EMAIL_CODE_TTL);
    await cacheSet(emailRateKey(email), "1", EMAIL_CODE_RATE_LIMIT);

    const result = await sendLoginEmailCode(email, code);
    if (!result.sent && !result.dev) {
      return createErrorResponse(
        result.error ?? "验证码发送失败",
        ErrorCode.INTERNAL_ERROR,
        500,
      );
    }

    const exposeDevCode =
      result.dev || process.env.NODE_ENV === "development";
    return createSuccessResponse({
      sent: true,
      ...(exposeDevCode ? { devCode: code } : {}),
    });
  } catch (error) {
    console.error("[send-email-code]", error);
    return createErrorResponse(
      "发送验证码失败",
      ErrorCode.INTERNAL_ERROR,
      500,
    );
  }
}
