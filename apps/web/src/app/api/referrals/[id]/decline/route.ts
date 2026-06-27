import { ErrorCode } from "@connectiq/types";
import { prisma } from "@connectiq/database";
import {
  ApiError,
  createErrorResponse,
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api-auth";
import { resolveMobileUserId } from "@/lib/mobile-user-id";
import { declineReferral } from "@/lib/referrals-service";


export const POST = withErrorHandler(async (request, context) => {
  const id = context?.params?.id;
  if (!id) {
    return createErrorResponse("缺少引荐 ID", ErrorCode.VALIDATION_ERROR, 400);
  }
  const userId = await resolveMobileUserId(request);
  const body = (await request.json().catch(() => ({}))) as {
    withdrawn?: boolean;
  };

  const referral = await declineReferral(userId, id, {
    withdrawn: body.withdrawn === true,
  });
  return createSuccessResponse({ referral });
});
