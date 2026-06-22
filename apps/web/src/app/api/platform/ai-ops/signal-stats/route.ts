import {
  createSuccessResponse,
  requirePlatformAdmin,
  withErrorHandler,
} from "@/lib/api-auth";
import { fetchSignalStats } from "@/lib/signal-ops-data";

export const GET = withErrorHandler(async () => {
  await requirePlatformAdmin();
  return createSuccessResponse(await fetchSignalStats());
});
