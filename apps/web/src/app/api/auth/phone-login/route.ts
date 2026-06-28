import { ErrorCode } from "@connectiq/types";
import { z } from "zod";
import {
  ApiError,
  createErrorResponse,
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api-auth";
import { miniPhoneLogin } from "@/lib/mini-auth-service";

const bodySchema = z.object({
  phone: z
    .string()
    .regex(/^1[3-9]\d{9}$/, "请输入有效的中国大陆手机号"),
  code: z.string().min(4).max(8),
  eventId: z.string().optional(),
});

/** 小程序短信验证码登录 */
export const POST = withErrorHandler(async (request) => {
  const body = await request.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);

  if (!parsed.success) {
    return createErrorResponse(
      parsed.error.issues[0]?.message ?? "手机号或验证码无效",
      ErrorCode.VALIDATION_ERROR,
      400,
    );
  }

  try {
    const result = await miniPhoneLogin(
      parsed.data.phone,
      parsed.data.code,
      parsed.data.eventId,
    );
    return createSuccessResponse(result);
  } catch (err) {
    if (err instanceof ApiError) {
      return createErrorResponse(err.message, err.code, err.status);
    }
    throw err;
  }
});
