import {
  createSuccessResponse,
  requirePlatformAdmin,
  withErrorHandler,
} from "@/lib/api-auth";
import {
  countPendingModeration,
  listModerationQueue,
} from "@/lib/moderation-service";

export const GET = withErrorHandler(async () => {
  await requirePlatformAdmin();
  const [items, pendingCount] = await Promise.all([
    listModerationQueue(),
    countPendingModeration(),
  ]);
  return createSuccessResponse({ items, pendingCount });
});
