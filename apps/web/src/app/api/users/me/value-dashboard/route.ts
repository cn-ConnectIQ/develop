import {
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api-auth";
import { resolveMobileUserId } from "@/lib/mobile-user-id";
import { fetchUserValueDashboard } from "@/lib/value-dashboard-service";

export const GET = withErrorHandler(async (request) => {
  const userId = await resolveMobileUserId(request);
  const dashboard = await fetchUserValueDashboard(userId);
  return createSuccessResponse(dashboard);
});
