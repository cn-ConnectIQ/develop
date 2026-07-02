import { ErrorCode } from "@connectiq/types";
import {
  createErrorResponse,
  createSuccessResponse,
  requireEventAccess,
  withErrorHandler,
} from "@/lib/api-auth";
import {
  defaultOrganizerEligibility,
  eligibleCountQuerySchema,
} from "@/lib/lottery/organizer-lottery-config";
import {
  countOrganizerEligibleUsers,
  loadOrganizerLotteryMeta,
} from "@/lib/lottery/organizer-lottery-service";

export const GET = withErrorHandler(async (request, context) => {
  const eventId = context?.params?.eventId;
  if (!eventId) {
    return createErrorResponse("缺少活动 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  await requireEventAccess(eventId);

  const { searchParams } = new URL(request.url);
  const parsed = eligibleCountQuerySchema.safeParse(
    Object.fromEntries(searchParams.entries()),
  );

  if (!parsed.success) {
    return createErrorResponse(
      parsed.error.issues[0]?.message ?? "参数错误",
      ErrorCode.VALIDATION_ERROR,
      400,
    );
  }

  const q = parsed.data;
  let criteria = defaultOrganizerEligibility();

  if (q.lottery_id) {
    const meta = await loadOrganizerLotteryMeta(eventId, q.lottery_id);
    criteria = { ...meta.eligibility };
  }

  if (q.require_checkin !== undefined) {
    criteria.require_checkin = q.require_checkin;
  }
  if (q.min_interactions !== undefined) {
    criteria.min_interactions = q.min_interactions;
  }
  if (q.require_stamp_rally !== undefined) {
    criteria.require_stamp_rally = q.require_stamp_rally;
  }
  if (q.stamp_rally_id !== undefined) {
    criteria.stamp_rally_id = q.stamp_rally_id;
  }
  if (q.min_connections !== undefined) {
    criteria.min_connections = q.min_connections;
  }

  const stats = await countOrganizerEligibleUsers(eventId, criteria, {
    lotteryId: q.lottery_id,
    targetEntryCount: q.target_entry_count ?? null,
  });

  return createSuccessResponse(stats);
});
