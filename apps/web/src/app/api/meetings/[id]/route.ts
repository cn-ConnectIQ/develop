import { ErrorCode } from "@connectiq/types";
import { MeetingStatus } from "@connectiq/database";
import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api-auth";
import { getMyMeetingDetail } from "@/lib/mobile-meetings-service";
import { updateMeetingStatus } from "@/lib/meetings-service";
import { resolveMobileUserId } from "@/lib/mobile-user-id";

export const GET = withErrorHandler(async (request, context) => {
  const id = context?.params?.id;
  if (!id) {
    return createErrorResponse("缺少会面 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  const userId = await resolveMobileUserId(request);
  const detail = await getMyMeetingDetail(userId, id);
  return createSuccessResponse(detail);
});

export const PATCH = withErrorHandler(async (request, context) => {
  const id = context?.params?.id;
  if (!id) {
    return createErrorResponse("缺少会面 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  const userId = await resolveMobileUserId(request);
  const body = (await request.json()) as {
    status?: MeetingStatus;
    rating?: number;
  };

  if (!body.status) {
    return createErrorResponse("缺少 status", ErrorCode.VALIDATION_ERROR, 400);
  }

  const meeting = await updateMeetingStatus(userId, id, body.status);
  return createSuccessResponse({
    id: meeting.id,
    status: meeting.status,
  });
});
