import { ErrorCode } from "@connectiq/types";
import { prisma } from "@connectiq/database";
import {
  ApiError,
  createErrorResponse,
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api-auth";
import { resolveMobileUserId } from "@/lib/mobile-user-id";
import { redeemPointsReward } from "@/lib/points-service";


export const POST = withErrorHandler(async (request) => {
  const userId = await resolveMobileUserId(request);
  const body = (await request.json()) as { reward_id?: string };

  if (!body.reward_id) {
    return createErrorResponse("缺少 reward_id", ErrorCode.VALIDATION_ERROR, 400);
  }

  const result = await redeemPointsReward(userId, body.reward_id);
  return createSuccessResponse(result);
});
