import { ErrorCode } from "@connectiq/types";
import { z } from "zod";
import {
  ApiError,
  createErrorResponse,
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api-auth";
import { miniWxLoginWithPhone } from "@/lib/mini-auth-service";

const bodySchema = z.object({
  wxCode: z.string().min(1),
  phoneCode: z.string().min(1),
  eventId: z.string().optional(),
});

export const POST = withErrorHandler(async (request) => {
  const body = await request.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);

  if (!parsed.success) {
    return createErrorResponse(
      parsed.error.issues[0]?.message ?? "缺少 wxCode 或 phoneCode",
      ErrorCode.VALIDATION_ERROR,
      400,
    );
  }

  try {
    const result = await miniWxLoginWithPhone(
      parsed.data.wxCode,
      parsed.data.phoneCode,
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
