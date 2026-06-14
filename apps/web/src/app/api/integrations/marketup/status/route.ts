import { createSuccessResponse, requireAuth, withErrorHandler } from "@/lib/api-auth";
import { getMarketupSyncStats } from "@/lib/marketup-sync";
import { UserRole } from "@connectiq/types";

export const GET = withErrorHandler(async () => {
  await requireAuth([UserRole.PLATFORM_ADMIN, UserRole.ORGANIZER]);
  const stats = await getMarketupSyncStats();
  return createSuccessResponse(stats);
});
