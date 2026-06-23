import {
  createSuccessResponse,
  requireEventAccess,
  withErrorHandler,
} from "@/lib/api-auth";
import { copyEvent } from "@/lib/event-lifecycle-service";

export const POST = withErrorHandler(async (_request, context) => {
  const eventId = context?.params?.eventId;
  if (!eventId) throw new Error("缺少活动 ID");
  const { session } = await requireEventAccess(eventId);
  const copied = await copyEvent(eventId, session.user.id);
  return createSuccessResponse({
    id: copied.id,
    name: copied.name,
    slug: copied.slug,
  });
});
