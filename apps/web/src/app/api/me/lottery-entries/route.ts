import { createSuccessResponse, withErrorHandler } from "@/lib/api-auth";
import { listMyLotteryEntries } from "@/lib/my-lottery-entries-service";
import { resolveMobileUserId } from "@/lib/mobile-user-id";

/** 我的抽奖参与记录 */
export const GET = withErrorHandler(async (request) => {
  const userId = await resolveMobileUserId(request);
  const items = await listMyLotteryEntries(userId);
  return createSuccessResponse({ items });
});
