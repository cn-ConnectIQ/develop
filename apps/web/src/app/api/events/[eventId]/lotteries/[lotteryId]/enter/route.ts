import { ErrorCode } from "@connectiq/types";
import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api-auth";
import { guardEventFeature } from "@/lib/event-feature-flag-guard";
import { enterLottery, getLotteryOrThrow } from "@/lib/interaction/lottery-service";
import { resolveMobileUserId } from "@/lib/mobile-user-id";

export const POST = withErrorHandler(async (request, context) => {
  const eventId = context?.params?.eventId;
  const lotteryId = context?.params?.lotteryId;
  if (!eventId || !lotteryId) {
    return createErrorResponse("参数缺失", ErrorCode.VALIDATION_ERROR, 400);
  }

  const userId = await resolveMobileUserId(request);
  const disabled = await guardEventFeature(eventId, "lottery");
  if (disabled) return disabled;
  await getLotteryOrThrow(eventId, lotteryId);

  const entry = await enterLottery(eventId, lotteryId, userId);

  return createSuccessResponse(entry);
});
