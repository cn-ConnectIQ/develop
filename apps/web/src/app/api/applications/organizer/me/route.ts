import { ErrorCode } from "@connectiq/types";
import {
  createErrorResponse,
  createSuccessResponse,
  requireAuthSession,
  withErrorHandler,
} from "@/lib/api-auth";
import { getOrganizerApplicationsByUserId } from "@/lib/organizer-application-service";

export const GET = withErrorHandler(async () => {
  const session = await requireAuthSession();
  if (!session) {
    return createErrorResponse("请先登录", ErrorCode.UNAUTHORIZED, 401);
  }

  const applications = await getOrganizerApplicationsByUserId(session.user.id);
  return createSuccessResponse(applications);
});
