import { ErrorCode } from "@connectiq/types";
import {
  createErrorResponse,
  createSuccessResponse,
  requireEventAccess,
  withErrorHandler,
} from "@/lib/api-auth";
import {
  getCampaignForEvent,
  resumeInviteCampaign,
} from "@/lib/invite/service";
import { guardEventFeature } from "@/lib/event-feature-flag-guard";

export const POST = withErrorHandler(async (_request, context) => {
  const eventId = context?.params?.eventId;
  const campaignId = context?.params?.campaignId;
  if (!eventId || !campaignId) {
    return createErrorResponse("参数缺失", ErrorCode.VALIDATION_ERROR, 400);
  }

  await requireEventAccess(eventId);
  const disabled = await guardEventFeature(eventId, "inviteSystem");
  if (disabled) return disabled;

  const existing = await getCampaignForEvent(eventId, campaignId);
  if (!existing) {
    return createErrorResponse("邀请活动不存在", ErrorCode.NOT_FOUND, 404);
  }

  try {
    const campaign = await resumeInviteCampaign(campaignId);
    return createSuccessResponse({ status: campaign.status });
  } catch (error) {
    if (error instanceof Error && error.message === "CAMPAIGN_NOT_PAUSED") {
      return createErrorResponse(
        "仅已暂停的活动可继续发送",
        ErrorCode.VALIDATION_ERROR,
        409,
      );
    }
    throw error;
  }
});
