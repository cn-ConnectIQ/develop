import { ErrorCode } from "@connectiq/types";
import {
  ApiError,
  createErrorResponse,
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api-auth";
import {
  lookupRedemptionCode,
  requireRedemptionStaffAccess,
} from "@/lib/lottery/redemption";

/** 核销台扫码查询：该码对应用户在本活动下的全部中奖记录 */
export const GET = withErrorHandler(async (request, context) => {
  const code = context?.params?.code;
  if (!code) {
    return createErrorResponse("缺少核销码", ErrorCode.VALIDATION_ERROR, 400);
  }

  const decodedCode = decodeURIComponent(code);

  let lookup;
  try {
    lookup = await lookupRedemptionCode(decodedCode);
  } catch (err) {
    if (err instanceof ApiError) {
      return createErrorResponse(err.message, err.code, err.status);
    }
    throw err;
  }

  await requireRedemptionStaffAccess(request, lookup.eventId);

  const eventIdParam = new URL(request.url).searchParams.get("eventId");
  if (eventIdParam && eventIdParam !== lookup.eventId) {
    return createErrorResponse(
      "核销码不属于本活动",
      ErrorCode.VALIDATION_ERROR,
      400,
    );
  }

  const { eventId: _eventId, ...data } = lookup;
  void _eventId;
  return createSuccessResponse(data);
});
