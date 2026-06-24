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
import { isEventFeatureEnabled } from "@/lib/event-feature-flags-server";

async function ensureAiReferralEnabled(eventId: string) {
  const enabled = await isEventFeatureEnabled(eventId, "aiReferral");
  if (!enabled) {
    return createErrorResponse("AI 引荐未开启", ErrorCode.FORBIDDEN, 403);
  }
  return null;
}

export const GET = withErrorHandler(async (_request, context) => {
  const eventId = context?.params?.eventId;
  if (!eventId) {
    return createErrorResponse("缺少活动 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  await requireEventAccess(eventId);
  const disabled = await ensureAiReferralEnabled(eventId);
  if (disabled) return disabled;
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
  const disabled = await ensureAiReferralEnabled(eventId);
  if (disabled) return disabled;
  const result = await scanReferralOpportunities(eventId);

  return createSuccessResponse({
    opportunitiesFound: result.opportunitiesFound,
    feedsCreated: result.feedsCreated,
  });
});
