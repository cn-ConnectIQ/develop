import { createSuccessResponse, withErrorHandler } from "@/lib/api-auth";
import { listMyLotteryEntries } from "@/lib/my-lottery-entries-service";
import { resolveMobileUserId } from "@/lib/mobile-user-id";

/** 我的抽奖参与记录（可选 eventId 筛选当前活动） */
export const GET = withErrorHandler(async (request) => {
  const userId = await resolveMobileUserId(request);
  const { searchParams } = new URL(request.url);
  const eventId = searchParams.get("eventId")?.trim() || undefined;
  const items = await listMyLotteryEntries(userId, eventId);
  return createSuccessResponse({ items });
});
