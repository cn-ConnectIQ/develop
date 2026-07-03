import { ScanActionType } from "@connectiq/database";
import { ErrorCode } from "@connectiq/types";
import { z } from "zod";
import {
  ApiError,
  createErrorResponse,
  createSuccessResponse,
  requireAuth,
  withErrorHandler,
} from "@/lib/api-auth";
import {
  requireMobileAccountAdmin,
  requireMobileEventAccess,
  resolveMobileUserId,
} from "@/lib/mobile-user-id";
import { getScanCheckinStats } from "@/lib/scan-execute-service";
import { executeScan } from "@/lib/scan/dispatch";

const scanActionValues = [
  ScanActionType.CHECKIN,
  ScanActionType.STAMP,
  ScanActionType.LOTTERY_VERIFY,
  ScanActionType.GIFT_VERIFY,
] as const;

const executeSchema = z.object({
  code: z.string().min(1),
  action: z.enum(scanActionValues),
  actionRef: z.string().optional(),
  eventId: z.string().min(1).optional(),
});

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

/** 签到核销统计（今日已签到人数） */
export const GET = withErrorHandler(async (request) => {
  const { searchParams } = new URL(request.url);
  const eventId = searchParams.get("eventId")?.trim();
  if (!eventId) {
    return createErrorResponse("缺少活动 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  await assertStaffScanAccess(request, eventId);
  const stats = await getScanCheckinStats(eventId);
  return createSuccessResponse(stats);
});

/**
 * 统一扫码执行接口
 * eventId：query `?eventId=` 或 body.eventId（操作端当前活动）
 */
export const POST = withErrorHandler(async (request) => {
  const { searchParams } = new URL(request.url);
  const body = await request.json().catch(() => ({}));
  const parsed = executeSchema.safeParse(body);
  if (!parsed.success) {
    throw new ApiError("参数错误", ErrorCode.VALIDATION_ERROR, 400);
  }

  const eventId =
    searchParams.get("eventId")?.trim() ?? parsed.data.eventId?.trim();
  if (!eventId) {
    throw new ApiError("缺少活动 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  await assertStaffScanAccess(request, eventId);

  const operatorId = await resolveOperatorId(request);

  const data = await executeScan({
    eventId,
    rawCode: parsed.data.code,
    action: parsed.data.action,
    actionRef: parsed.data.actionRef,
    operatorId,
  });

  return createSuccessResponse(data);
});
