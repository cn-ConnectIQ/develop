import { ErrorCode } from "@connectiq/types";
import {
  createErrorResponse,
  createSuccessResponse,
  requireEventAccess,
  withErrorHandler,
} from "@/lib/api-auth";
import { getCampaignForEvent } from "@/lib/invite/service";

export const GET = withErrorHandler(async (_request, context) => {
  const eventId = context?.params?.eventId;
  const campaignId = context?.params?.campaignId;

  if (!eventId || !campaignId) {
    return createErrorResponse("参数缺失", ErrorCode.VALIDATION_ERROR, 400);
  }

  await requireEventAccess(eventId);

  const campaign = await getCampaignForEvent(eventId, campaignId);
  if (!campaign) {
    return createErrorResponse("邀请活动不存在", ErrorCode.NOT_FOUND, 404);
  }

  const progress =
    campaign.totalTarget > 0
      ? Math.round((campaign.sentCount / campaign.totalTarget) * 100)
      : 0;

  return createSuccessResponse({
    ...campaign,
    progress,
  });
});
