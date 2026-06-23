import {
  createSuccessResponse,
  requireEventAccess,
  withErrorHandler,
} from "@/lib/api-auth";
import { listRallyParticipantProgress } from "@/lib/stamp-rally-service";

export const GET = withErrorHandler(async (_request, context) => {
  const eventId = context?.params?.eventId;
  const rallyId = context?.params?.rallyId;
  if (!eventId || !rallyId) throw new Error("参数缺失");
  await requireEventAccess(eventId);
  const progress = await listRallyParticipantProgress(eventId, rallyId);
  return createSuccessResponse({ progress });
});
