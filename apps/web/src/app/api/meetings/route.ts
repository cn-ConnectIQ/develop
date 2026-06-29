import { ErrorCode } from "@connectiq/types";
import { prisma } from "@connectiq/database";
import { z } from "zod";
import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api-auth";
import { bookMeeting } from "@/lib/meetings-service";
import { resolveMobileUserId } from "@/lib/mobile-user-id";

const createSchema = z.object({
  event_id: z.string().cuid(),
  guest_user_id: z.string().cuid(),
  starts_at: z.string().datetime(),
  ends_at: z.string().datetime(),
  message: z.string().max(500).optional(),
});

export const POST = withErrorHandler(async (request) => {
  const hostUserId = await resolveMobileUserId(request);
  const body = await request.json().catch(() => ({}));
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return createErrorResponse("参数错误", ErrorCode.VALIDATION_ERROR, 400);
  }

  const event = await prisma.event.findUnique({
    where: { id: parsed.data.event_id },
    select: { id: true },
  });
  if (!event) {
    return createErrorResponse("活动不存在", ErrorCode.NOT_FOUND, 404);
  }

  const meeting = await bookMeeting({
    eventId: parsed.data.event_id,
    requesterId: hostUserId,
    recipientId: parsed.data.guest_user_id,
    startsAt: new Date(parsed.data.starts_at),
    endsAt: new Date(parsed.data.ends_at),
    message: parsed.data.message,
  });

  return createSuccessResponse({
    id: meeting.id,
    status: meeting.status,
    starts_at: meeting.scheduledStart?.toISOString(),
    ends_at: meeting.scheduledEnd?.toISOString(),
  });
});
