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
  parseTargetFilter,
  retryFailedRecords,
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

  const campaign = await getCampaignForEvent(eventId, campaignId);
  if (!campaign) {
    return createErrorResponse("邀请活动不存在", ErrorCode.NOT_FOUND, 404);
  }

  try {
    await assertExperienceCanSendCampaign(session.user.id, {
      totalTarget: campaign.totalTarget,
      targetFilter: parseTargetFilter(campaign.targetFilter),
    });
  } catch (error) {
    if (error instanceof ExperienceAccountError) {
      return createErrorResponse(error.message, ErrorCode.FORBIDDEN, 403);
    }
    throw error;
  }

  const retried = await retryFailedRecords(campaignId);

  if (retried > 0) {
    await triggerInviteProcessing(campaignId);
  }

  return createSuccessResponse({ retried });
});
