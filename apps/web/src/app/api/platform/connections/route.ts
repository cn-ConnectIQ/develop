import {
  createSuccessResponse,
  requirePlatformAdmin,
  withErrorHandler,
} from "@/lib/api-auth";
import { getPlatformConnections } from "@/lib/platform-data";

export const GET = withErrorHandler(async (request) => {
  await requirePlatformAdmin();
  const { searchParams } = new URL(request.url);
  const data = await getPlatformConnections({
    eventId: searchParams.get("eventId") ?? undefined,
    source: searchParams.get("source") ?? undefined,
    status: searchParams.get("status") ?? undefined,
  });
  return createSuccessResponse(data);
});
