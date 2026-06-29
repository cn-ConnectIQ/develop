import { ErrorCode } from "@connectiq/types";
import { MeetingStatus } from "@connectiq/database";
import { z } from "zod";
import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api-auth";
import { getMyMeetingDetail } from "@/lib/mobile-meetings-service";
import {
  rescheduleMeeting,
  updateMeetingStatus,
} from "@/lib/meetings-service";
import { resolveMobileUserId } from "@/lib/mobile-user-id";

const patchSchema = z.object({
  status: z.enum(["ACCEPTED", "DECLINED"]).optional(),
  reason: z.string().max(500).optional(),
  starts_at: z.string().datetime().optional(),
  ends_at: z.string().datetime().optional(),
});

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
  const body = await request.json().catch(() => ({}));
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return createErrorResponse("参数错误", ErrorCode.VALIDATION_ERROR, 400);
  }

  if (parsed.data.starts_at && parsed.data.ends_at) {
    const meeting = await rescheduleMeeting(
      userId,
      id,
      new Date(parsed.data.starts_at),
      new Date(parsed.data.ends_at),
    );
    return createSuccessResponse({
      id: meeting.id,
      status: meeting.status,
      starts_at: meeting.scheduledStart?.toISOString(),
      ends_at: meeting.scheduledEnd?.toISOString(),
    });
  }

  if (!parsed.data.status) {
    return createErrorResponse("缺少 status 或改期时间", ErrorCode.VALIDATION_ERROR, 400);
  }

  const meeting = await updateMeetingStatus(
    userId,
    id,
    parsed.data.status as MeetingStatus,
    { reason: parsed.data.reason },
  );
  return createSuccessResponse({
    id: meeting.id,
    status: meeting.status,
  });
});
