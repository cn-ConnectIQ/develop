import { ErrorCode } from "@connectiq/types";
import { z } from "zod";
import {
  ApiError,
  createErrorResponse,
  createSuccessResponse,
  requireEventAccess,
  withErrorHandler,
} from "@/lib/api-auth";
import { redeemVerificationCode } from "@/lib/lottery/prize-verification-service";

const redeemSchema = z.object({
  event_id: z.string().min(1),
});

export const POST = withErrorHandler(async (request, context) => {
  const code = context?.params?.code;
  if (!code) {
    return createErrorResponse("缺少核销码", ErrorCode.VALIDATION_ERROR, 400);
  }

  const body = await request.json().catch(() => ({}));
  const parsed = redeemSchema.safeParse(body);
  if (!parsed.success) {
    return createErrorResponse(
      parsed.error.issues[0]?.message ?? "参数错误",
      ErrorCode.VALIDATION_ERROR,
      400,
    );
  }

  const { session } = await requireEventAccess(parsed.data.event_id);

  try {
    const result = await redeemVerificationCode(
      decodeURIComponent(code),
      parsed.data.event_id,
      session.user.id,
    );
    return createSuccessResponse(result);
  } catch (err) {
    if (err instanceof ApiError) {
      return createErrorResponse(err.message, err.code, err.status);
    }
    throw err;
  }
});
