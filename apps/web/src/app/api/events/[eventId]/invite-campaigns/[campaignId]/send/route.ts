import { ErrorCode } from "@connectiq/types";
import {
  createErrorResponse,
  createSuccessResponse,
  requireEventAccess,
  withErrorHandler,
} from "@/lib/api-auth";
import { triggerInviteProcessing } from "@/lib/invite/queue";
import {
  getCampaignForEvent,
  prepareCampaignSend,
} from "@/lib/invite/service";
import { guardEventFeature } from "@/lib/event-feature-flag-guard";
import {
  assertExperienceCanSendInvite,
  ExperienceAccountError,
} from "@/lib/experience/experience-account-service";

export const POST = withErrorHandler(async (_request, context) => {
  const eventId = context?.params?.eventId;
  const campaignId = context?.params?.campaignId;

  if (!eventId || !campaignId) {
    return createErrorResponse("参数缺失", ErrorCode.VALIDATION_ERROR, 400);
  }

  const { session } = await requireEventAccess(eventId);
  const disabled = await guardEventFeature(eventId, "inviteSystem");
  if (disabled) return disabled;

  const existing = await getCampaignForEvent(eventId, campaignId);
  if (!existing) {
    return createErrorResponse("邀请活动不存在", ErrorCode.NOT_FOUND, 404);
  }

  try {
    await assertExperienceCanSendInvite(session.user.id, existing.channel);
  } catch (error) {
    if (error instanceof ExperienceAccountError) {
      return createErrorResponse(error.message, ErrorCode.FORBIDDEN, 403);
    }
    throw error;
  }

  try {
    const result = await prepareCampaignSend(campaignId);

    if (!result.building && !result.isScheduled && result.queued > 0) {
      await triggerInviteProcessing(campaignId);
    }

    return createSuccessResponse({
      queued: result.queued,
      skipped: result.skipped,
      total_target: result.totalTarget,
      scheduled: result.isScheduled,
      building: Boolean(result.building),
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "CAMPAIGN_NOT_FOUND") {
        return createErrorResponse("邀请活动不存在", ErrorCode.NOT_FOUND, 404);
      }
      if (error.message === "CAMPAIGN_ALREADY_SENT") {
        return createErrorResponse(
          "邀请活动已发送或正在发送中",
          ErrorCode.VALIDATION_ERROR,
          409,
        );
      }
      if (error.message === "CAMPAIGN_BUILDING") {
        return createErrorResponse(
          "正在准备收件人列表，请稍后再试",
          ErrorCode.VALIDATION_ERROR,
          409,
        );
      }
      if (error.message === "CAMPAIGN_PAUSED") {
        return createErrorResponse(
          "活动已暂停，请先继续发送",
          ErrorCode.VALIDATION_ERROR,
          409,
        );
      }
    }
    throw error;
  }
});
