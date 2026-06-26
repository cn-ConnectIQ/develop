import { ActivityType, prisma } from "@connectiq/database";
import { ErrorCode } from "@connectiq/types";
import { z } from "zod";
import {
  createErrorResponse,
  createSuccessResponse,
  requireEventAccess,
  withErrorHandler,
} from "@/lib/api-auth";
import {
  getMeetingConfig,
  updateMeetingConfig,
} from "@/lib/meeting-config-service";

const timeWindowSchema = z.object({
  start: z.string().regex(/^\d{2}:\d{2}$/),
  end: z.string().regex(/^\d{2}:\d{2}$/),
});

const patchSchema = z
  .object({
    meeting_enabled: z.boolean().optional(),
    meeting_slot_minutes: z
      .union([z.literal(15), z.literal(20), z.literal(30), z.literal(45)])
      .optional(),
    meeting_buffer_minutes: z.union([z.literal(5), z.literal(10)]).optional(),
    meeting_open_at: z.string().datetime().nullable().optional(),
    time_windows: z.array(timeWindowSchema).optional(),
  })
  .partial();

async function assertMeetingHostEvent(eventId: string) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { activityType: true },
  });
  if (!event) return createErrorResponse("活动不存在", ErrorCode.NOT_FOUND, 404);
  if (event.activityType === ActivityType.EXHIBITION) {
    return createErrorResponse("参展活动不支持会面配置", ErrorCode.FORBIDDEN, 403);
  }
  return null;
}

export const GET = withErrorHandler(async (_request, context) => {
  const eventId = context?.params?.eventId;
  if (!eventId) {
    return createErrorResponse("缺少活动 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  await requireEventAccess(eventId);
  const forbidden = await assertMeetingHostEvent(eventId);
  if (forbidden) return forbidden;

  const config = await getMeetingConfig(eventId);
  return createSuccessResponse(config);
});

export const PATCH = withErrorHandler(async (request, context) => {
  const eventId = context?.params?.eventId;
  if (!eventId) {
    return createErrorResponse("缺少活动 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  await requireEventAccess(eventId);
  const forbidden = await assertMeetingHostEvent(eventId);
  if (forbidden) return forbidden;

  const body = await request.json().catch(() => ({}));
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return createErrorResponse("参数错误", ErrorCode.VALIDATION_ERROR, 400);
  }

  const config = await updateMeetingConfig(eventId, parsed.data);
  return createSuccessResponse(config);
});
