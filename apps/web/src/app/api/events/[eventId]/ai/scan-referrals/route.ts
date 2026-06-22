import { ErrorCode } from "@connectiq/types";
import {
  createErrorResponse,
  createSuccessResponse,
  requireEventAccess,
  withErrorHandler,
} from "@/lib/api-auth";
import {
  getLatestReferralScan,
  scanReferralOpportunities,
} from "@/lib/ai/referral-scanner";

export const GET = withErrorHandler(async (_request, context) => {
  const eventId = context?.params?.eventId;
  if (!eventId) {
    return createErrorResponse("缺少活动 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  await requireEventAccess(eventId);
  const lastScan = await getLatestReferralScan(eventId);

  return createSuccessResponse({
    lastScan: lastScan
      ? {
          scanned_at: lastScan.scannedAt.toISOString(),
          pairs_found: lastScan.pairsFound,
          feeds_created: lastScan.feedsCreated,
        }
      : null,
  });
});

export const POST = withErrorHandler(async (_request, context) => {
  const eventId = context?.params?.eventId;
  if (!eventId) {
    return createErrorResponse("缺少活动 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  await requireEventAccess(eventId);
  const result = await scanReferralOpportunities(eventId);

  return createSuccessResponse({
    opportunitiesFound: result.opportunitiesFound,
    feedsCreated: result.feedsCreated,
  });
});
