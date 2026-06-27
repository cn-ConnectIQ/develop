import { ErrorCode } from "@connectiq/types";
import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api-auth";
import { cancelMeeting } from "@/lib/meetings-service";
import { resolveMobileUserId } from "@/lib/mobile-user-id";

export const POST = withErrorHandler(async (request, context) => {
  const id = context?.params?.id;
  if (!id) {
    return createErrorResponse("缺少会面 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  const userId = await resolveMobileUserId(request);
  const body = (await request.json()) as {
    reason?: string;
    notify_other?: boolean;
  };

  if (!body.reason?.trim()) {
    return createErrorResponse("请选择取消原因", ErrorCode.VALIDATION_ERROR, 400);
  }

  const meeting = await cancelMeeting(
    userId,
    id,
    body.reason.trim(),
    body.notify_other !== false,
  );

  return createSuccessResponse({
    id: meeting.id,
    status: meeting.status,
    cancel_reason: meeting.message,
  });
});
