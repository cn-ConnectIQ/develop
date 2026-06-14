import {
  createSuccessResponse,
  requirePlatformAdmin,
  withErrorHandler,
} from "@/lib/api-auth";
import { fetchInsightsStats } from "@/lib/ai-ops-data";

export const GET = withErrorHandler(async (request) => {
  await requirePlatformAdmin();
  const period =
    new URL(request.url).searchParams.get("period") ?? "2026-06";
  return createSuccessResponse(await fetchInsightsStats(period));
});
