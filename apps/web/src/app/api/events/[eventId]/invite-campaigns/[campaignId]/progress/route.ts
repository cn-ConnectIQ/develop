import { ErrorCode } from "@connectiq/types";
import {
  createErrorResponse,
  createSuccessResponse,
  requireEventAccess,
  withErrorHandler,
} from "@/lib/api-auth";
import { getCampaignProgress } from "@/lib/invite/service";

export const GET = withErrorHandler(async (_request, context) => {
  const eventId = context?.params?.eventId;
  const campaignId = context?.params?.campaignId;

  if (!eventId || !campaignId) {
    return createErrorResponse("参数缺失", ErrorCode.VALIDATION_ERROR, 400);
  }

  await requireEventAccess(eventId);

  const progress = await getCampaignProgress(eventId, campaignId);
  if (!progress) {
    return createErrorResponse("邀请活动不存在", ErrorCode.NOT_FOUND, 404);
  }

  const sendPct =
    progress.totalTarget > 0
      ? Math.round((progress.sentCount / progress.totalTarget) * 1000) / 10
      : 0;

  return createSuccessResponse({
    status: progress.status,
    total_target: progress.totalTarget,
    sent_count: progress.sentCount,
    delivered_count: progress.deliveredCount,
    clicked_count: progress.clickedCount,
    activated_count: progress.activatedCount,
    failed_count: progress.failedCount,
    skipped_count: progress.skippedCount,
    pending_count: progress.pendingCount,
    started_at: progress.startedAt?.toISOString() ?? null,
    completed_at: progress.completedAt?.toISOString() ?? null,
    created_at: progress.createdAt.toISOString(),
    estimated_completion: progress.estimatedCompletion?.toISOString() ?? null,
    send_percent: sendPct,
    name: progress.name,
    channel: progress.channel,
    custom_message: progress.customMessage,
    subject: progress.subject,
    template_id: progress.templateId,
    target_filter: progress.targetFilter,
  });
});
