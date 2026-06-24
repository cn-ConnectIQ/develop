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
  retryFailedRecords,
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

  const campaign = await getCampaignForEvent(eventId, campaignId);
  if (!campaign) {
    return createErrorResponse("邀请活动不存在", ErrorCode.NOT_FOUND, 404);
  }

  const retried = await retryFailedRecords(campaignId);

  if (retried > 0) {
    await triggerInviteProcessing(campaignId);
  }

  return createSuccessResponse({ retried });
});
