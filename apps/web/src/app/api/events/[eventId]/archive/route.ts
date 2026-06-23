import {
  createSuccessResponse,
  requireEventAccess,
  withErrorHandler,
} from "@/lib/api-auth";
import { archiveEvent } from "@/lib/event-lifecycle-service";

export const POST = withErrorHandler(async (_request, context) => {
  const eventId = context?.params?.eventId;
  if (!eventId) throw new Error("缺少活动 ID");
  await requireEventAccess(eventId);
  const event = await archiveEvent(eventId);
  return createSuccessResponse({ id: event.id, status: event.status });
});
