import {
  createSuccessResponse,
  requirePlatformAdmin,
  withErrorHandler,
} from "@/lib/api-auth";
import { fetchGenerationStats } from "@/lib/ai-ops-data";

export const GET = withErrorHandler(async () => {
  await requirePlatformAdmin();
  return createSuccessResponse(await fetchGenerationStats());
});
