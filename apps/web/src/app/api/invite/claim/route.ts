import { ErrorCode } from "@connectiq/types";
import { z } from "zod";
import {
  ApiError,
  createErrorResponse,
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api-auth";
import {
  claimInviteWithPhone,
  enterAsUnverifiedGuest,
  silentClaimByWxCode,
} from "@/lib/invite/claim-service";

/**
 * POST /api/invite/claim
 * action:
 *  - silent: 老用户 wxCode 静默
 *  - phone: 新用户 getPhoneNumber（phoneCode）
 *  - guest: 拒绝授权 → 渐进式访客
 */
export const POST = withErrorHandler(async (request) => {
  const body = await request.json().catch(() => ({}));
  const schema = z.object({
    token: z.string().min(1),
    action: z.enum(["silent", "phone", "guest"]),
    wxCode: z.string().min(1),
    phoneCode: z.string().optional(),
  });
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return createErrorResponse("参数错误", ErrorCode.VALIDATION_ERROR, 400);
  }

  try {
    if (parsed.data.action === "silent") {
      const result = await silentClaimByWxCode({
        token: parsed.data.token,
        wxCode: parsed.data.wxCode,
      });
      return createSuccessResponse(result);
    }
    if (parsed.data.action === "guest") {
      const result = await enterAsUnverifiedGuest({
        token: parsed.data.token,
        wxCode: parsed.data.wxCode,
      });
      return createSuccessResponse(result);
    }
    if (!parsed.data.phoneCode) {
      return createErrorResponse("缺少 phoneCode", ErrorCode.VALIDATION_ERROR, 400);
    }
    const result = await claimInviteWithPhone({
      token: parsed.data.token,
      wxCode: parsed.data.wxCode,
      phoneCode: parsed.data.phoneCode,
    });
    return createSuccessResponse(result);
  } catch (err) {
    if (err instanceof ApiError) {
      return createErrorResponse(err.message, err.code, err.status);
    }
    throw err;
  }
});
