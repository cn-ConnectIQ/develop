import { ErrorCode } from "@connectiq/types";
import {
  createErrorResponse,
  createSuccessResponse,
  requireAuth,
  withErrorHandler,
} from "@/lib/api-auth";
import {
  countTodayStampsAtPoint,
  listOperatorStampPoints,
} from "@/lib/scan/stamp-points-service";
import {
  requireMobileAccountAdmin,
  requireMobileEventAccess,
  resolveMobileUserId,
} from "@/lib/mobile-user-id";

async function resolveOperatorId(request: Request): Promise<string> {
  try {
    return await resolveMobileUserId(request);
  } catch {
    const { user } = await requireAuth();
    return user.id;
  }
}

async function assertStaffScanAccess(request: Request, eventId: string) {
  try {
    await requireMobileEventAccess(request, eventId);
    return;
  } catch {
    // fall through
  }
  await requireMobileAccountAdmin(request);
}

/** 操作员可负责的集章打卡点；带 stampId 时返回今日打卡人次 */
export const GET = withErrorHandler(async (request) => {
  const { searchParams } = new URL(request.url);
  const eventId = searchParams.get("eventId")?.trim();
  if (!eventId) {
    return createErrorResponse("缺少活动 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  await assertStaffScanAccess(request, eventId);
  const operatorId = await resolveOperatorId(request);
  const boothId = searchParams.get("boothId")?.trim() || undefined;
  const stampId = searchParams.get("stampId")?.trim() || undefined;

  const points = await listOperatorStampPoints(eventId, operatorId, { boothId });

  let today_stamp_count: number | undefined;
  if (stampId) {
    const allowed = points.some((p) => p.stamp_id === stampId);
    if (allowed) {
      today_stamp_count = await countTodayStampsAtPoint(stampId);
    }
  }

  return createSuccessResponse({
    points,
    today_stamp_count,
  });
});
