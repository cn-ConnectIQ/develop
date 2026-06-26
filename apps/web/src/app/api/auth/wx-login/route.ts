import { ErrorCode } from "@connectiq/types";
import { z } from "zod";
import {
  ApiError,
  createErrorResponse,
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api-auth";
import { miniWxLogin } from "@/lib/mini-auth-service";

const bodySchema = z.object({
  code: z.string().min(1),
  eventId: z.string().optional(),
});

/** 小程序微信 code 登录（openid upsert + 可选关联活动 Participant） */
export const POST = withErrorHandler(async (request) => {
  const body = await request.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);

  if (!parsed.success) {
    return createErrorResponse(
      parsed.error.issues[0]?.message ?? "缺少 code",
      ErrorCode.VALIDATION_ERROR,
      400,
    );
  }

  try {
    const result = await miniWxLogin(parsed.data.code, parsed.data.eventId);
    return createSuccessResponse(result);
  } catch (err) {
    if (err instanceof ApiError) {
      return createErrorResponse(err.message, err.code, err.status);
    }
    throw err;
  }
});
