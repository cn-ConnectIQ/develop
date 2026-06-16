import { ErrorCode } from "@connectiq/types";
import {
  createErrorResponse,
  createSuccessResponse,
  requireAuthSession,
  withErrorHandler,
} from "@/lib/api-auth";
import { getOrganizerApplicationByUserId } from "@/lib/organizer-application-service";

export const GET = withErrorHandler(async () => {
  const session = await requireAuthSession();
  if (!session) {
    return createErrorResponse("请先登录", ErrorCode.UNAUTHORIZED, 401);
  }

  const application = await getOrganizerApplicationByUserId(session.user.id);
  if (!application) {
    return createErrorResponse("暂无申请记录", ErrorCode.NOT_FOUND, 404);
  }

  return createSuccessResponse(application);
});
