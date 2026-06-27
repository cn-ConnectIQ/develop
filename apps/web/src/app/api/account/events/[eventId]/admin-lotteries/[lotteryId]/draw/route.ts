import { ErrorCode } from "@connectiq/types";
import { z } from "zod";
import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api-auth";
import { adminDrawLottery } from "@/lib/mobile-admin-ops-service";
import { requireMobileAccountAdmin } from "@/lib/mobile-user-id";

const bodySchema = z.object({
  prize_rank: z.number().int().min(1).max(10).optional(),
  count: z.number().int().min(1).max(50).optional(),
});

/** AD3 执行抽奖开奖 */
export const POST = withErrorHandler(async (request, context) => {
  const eventId = context?.params?.eventId;
  const lotteryId = context?.params?.lotteryId;
  if (!eventId || !lotteryId) {
    return createErrorResponse("缺少活动或抽奖 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  const { orgId } = await requireMobileAccountAdmin(request);
  const raw = await request.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(raw);
  const prizeRank = parsed.success ? parsed.data.prize_rank : undefined;
  const count = parsed.success ? parsed.data.count : undefined;

  const result = await adminDrawLottery(
    orgId,
    eventId,
    lotteryId,
    prizeRank ?? 1,
    count ?? 1,
  );
  return createSuccessResponse(result);
});
