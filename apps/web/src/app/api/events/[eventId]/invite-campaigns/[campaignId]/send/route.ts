import { ErrorCode } from "@connectiq/types";
import {
  ApiError,
  createErrorResponse,
  createSuccessResponse,
  requireEventAccess,
  withErrorHandler,
} from "@/lib/api-auth";
import { triggerInviteProcessing } from "@/lib/invite/queue";
import {
  getCampaignForEvent,
  prepareCampaignSend,
  parseTargetFilter,
} from "@/lib/invite/service";
import { guardEventFeature } from "@/lib/event-feature-flag-guard";
import {
  assertExperienceCanSendCampaign,
} from "@/lib/experience/experience-invite-guards";
import { ExperienceAccountError } from "@/lib/experience/experience-account-service";

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
    await assertExperienceCanSendCampaign(session.user.id, {
      totalTarget: existing.totalTarget,
      targetFilter: parseTargetFilter(existing.targetFilter),
    });
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
    if (error instanceof ApiError) {
      if (error.status === 402) {
        return Response.json(
          {
            error: error.message,
            code: error.code,
            reason: "INSUFFICIENT_INVITE_CREDIT",
            redirect_to: "/organizer/billing",
          },
          { status: 402 },
        );
      }
      return createErrorResponse(error.message, error.code, error.status);
    }
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
      if (
        error.message.includes("额度不足") ||
        error.message.includes("余额不足")
      ) {
        return Response.json(
          {
            error: error.message,
            code: ErrorCode.VALIDATION_ERROR,
            reason: "INSUFFICIENT_INVITE_CREDIT",
            redirect_to: "/organizer/billing",
          },
          { status: 402 },
        );
      }
    }
    throw error;
  }
});
