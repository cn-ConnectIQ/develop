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
  verifyRedemptionWinner,
} from "@/lib/lottery/redemption";

/** 单个奖品核销 */
export const POST = withErrorHandler(async (request, context) => {
  const code = context?.params?.code;
  const winnerId = context?.params?.winnerId;
  if (!code || !winnerId) {
    return createErrorResponse("参数缺失", ErrorCode.VALIDATION_ERROR, 400);
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

  const { userId: verifierUserId } = await requireRedemptionStaffAccess(
    request,
    lookup.eventId,
  );

  try {
    const prize = await verifyRedemptionWinner(
      decodedCode,
      winnerId,
      verifierUserId,
    );
    return createSuccessResponse({ prize });
  } catch (err) {
    if (err instanceof ApiError) {
      return createErrorResponse(err.message, err.code, err.status);
    }
    throw err;
  }
});
