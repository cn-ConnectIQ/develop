import { ErrorCode } from "@connectiq/types";
import { z } from "zod";
import {
  createErrorResponse,
  createSuccessResponse,
  requireEventAccess,
  withErrorHandler,
} from "@/lib/api-auth";
import { reassignMeeting } from "@/lib/meetings/schedule-service";

const patchSchema = z.object({
  scheduled_start: z.string().datetime(),
  scheduled_end: z.string().datetime(),
  table_id: z.string().cuid(),
});

export const PATCH = withErrorHandler(async (request, context) => {
  const eventId = context?.params?.eventId;
  const meetingId = context?.params?.id;
  if (!eventId || !meetingId) {
    return createErrorResponse("参数缺失", ErrorCode.VALIDATION_ERROR, 400);
  }

  await requireEventAccess(eventId);

  const body = await request.json().catch(() => ({}));
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return createErrorResponse("参数错误", ErrorCode.VALIDATION_ERROR, 400);
  }

  const meeting = await reassignMeeting(eventId, meetingId, parsed.data);
  return createSuccessResponse(meeting);
});
