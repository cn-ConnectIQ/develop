import {
  createSuccessResponse,
  requirePlatformAdmin,
  withErrorHandler,
} from "@/lib/api-auth";
import { fetchFeedbackStats } from "@/lib/ai-ops-data";

export const GET = withErrorHandler(async () => {
  await requirePlatformAdmin();
  return createSuccessResponse(await fetchFeedbackStats());
});
