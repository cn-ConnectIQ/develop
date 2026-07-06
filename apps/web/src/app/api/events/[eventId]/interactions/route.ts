import { ErrorCode } from "@connectiq/types";
import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api-auth";
import {
  aggregateEventInteractions,
  parseInteractionTypeFilter,
} from "@/lib/interactions/aggregate";
import { resolveMobileUserId } from "@/lib/mobile-user-id";
import { assertAttendeeReadableEvent } from "@/lib/public-event-access";

/** 公告 / 投票 / 抽奖 · 统一互动列表（小程序） */
export const GET = withErrorHandler(async (request, context) => {
  const eventId = context?.params?.eventId;
  if (!eventId) {
    return createErrorResponse("缺少活动 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  const userId = await resolveMobileUserId(request);
  await assertAttendeeReadableEvent(eventId);

  const url = new URL(request.url);
  const typeFilter = parseInteractionTypeFilter(url.searchParams.get("type"));
  if (url.searchParams.get("type")?.trim() && !typeFilter) {
    return createErrorResponse(
      "type 须为 ANNOUNCEMENT | POLL | LOTTERY",
      ErrorCode.VALIDATION_ERROR,
      400,
    );
  }

  const limitRaw = url.searchParams.get("limit");
  const limit = limitRaw ? Number(limitRaw) : undefined;
  if (limitRaw && (!Number.isFinite(limit) || limit! <= 0)) {
    return createErrorResponse("limit 须为正整数", ErrorCode.VALIDATION_ERROR, 400);
  }

  const result = await aggregateEventInteractions({
    eventId,
    userId,
    types: typeFilter,
    cursor: url.searchParams.get("cursor"),
    limit,
  });

  return createSuccessResponse({
    items: result.items,
    nextCursor: result.nextCursor,
  });
});
