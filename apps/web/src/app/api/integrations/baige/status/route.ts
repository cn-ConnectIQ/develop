import { createSuccessResponse, requireAuth, withErrorHandler } from "@/lib/api-auth";
import { getBaigeConnectionStatus } from "@/lib/integrations/baige-connection";
import { UserRole } from "@connectiq/types";

export const GET = withErrorHandler(async () => {
  await requireAuth([UserRole.PLATFORM_ADMIN, UserRole.ORGANIZER]);
  const status = await getBaigeConnectionStatus();
  return createSuccessResponse(status);
});
