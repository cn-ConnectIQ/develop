import {
  createSuccessResponse,
  requirePlatformAdmin,
  withErrorHandler,
} from "@/lib/api-auth";
import { getPlatformOverviewStats } from "@/lib/platform-data";

export const GET = withErrorHandler(async () => {
  await requirePlatformAdmin();
  const data = await getPlatformOverviewStats();
  return createSuccessResponse(data);
});
