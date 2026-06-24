import { ErrorCode } from "@connectiq/types";
import { z } from "zod";
import {
  createErrorResponse,
  createSuccessResponse,
  requireEventAccess,
  withErrorHandler,
} from "@/lib/api-auth";
import {
  getEventMarketupSyncStats,
  retryMarketupSync,
  scheduleLeadMarketupSync,
} from "@/lib/marketup-sync";
import { getExternalSync, parseFieldMap, parseSyncConfig } from "@/lib/external-sync";

const retrySchema = z.object({
  leadId: z.string().cuid().optional(),
  jobId: z.string().cuid().optional(),
});

/** 活动级 MarketUP 同步状态（S2D 回流监控） */
export const GET = withErrorHandler(async (_request, context) => {
  const eventId = context?.params?.eventId;
  if (!eventId) {
    return createErrorResponse("缺少活动 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  await requireEventAccess(eventId);

  const [stats, externalSync] = await Promise.all([
    getEventMarketupSyncStats(eventId),
    getExternalSync(eventId),
  ]);

  return createSuccessResponse({
    ...stats,
    fieldMap: parseFieldMap(externalSync.fieldMap),
    syncConfig: parseSyncConfig(externalSync.syncConfig),
  });
});

export const POST = withErrorHandler(async (request, context) => {
  const eventId = context?.params?.eventId;
  if (!eventId) {
    return createErrorResponse("缺少活动 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  await requireEventAccess(eventId);

  const body = await request.json().catch(() => ({}));
  const parsed = retrySchema.safeParse(body);
  if (!parsed.success) {
    return createErrorResponse("参数错误", ErrorCode.VALIDATION_ERROR, 400);
  }

  if (parsed.data.leadId) {
    const lead = await retryMarketupSync(undefined, parsed.data.leadId);
    return createSuccessResponse(lead);
  }

  if (parsed.data.jobId) {
    const result = await retryMarketupSync(parsed.data.jobId);
    return createSuccessResponse(result);
  }

  return createErrorResponse("缺少 leadId 或 jobId", ErrorCode.VALIDATION_ERROR, 400);
});

/** 手动触发单条线索同步（测试/补同步） */
export const PATCH = withErrorHandler(async (request, context) => {
  const eventId = context?.params?.eventId;
  if (!eventId) {
    return createErrorResponse("缺少活动 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  await requireEventAccess(eventId);

  const body = await request.json().catch(() => ({}));
  const parsed = z.object({ leadId: z.string().cuid() }).safeParse(body);
  if (!parsed.success) {
    return createErrorResponse("参数错误", ErrorCode.VALIDATION_ERROR, 400);
  }

  const result = await scheduleLeadMarketupSync(parsed.data.leadId, eventId);
  return createSuccessResponse(result);
});
