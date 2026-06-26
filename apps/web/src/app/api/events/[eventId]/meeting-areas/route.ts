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
  createMeetingArea,
  deleteMeetingArea,
  listMeetingAreas,
} from "@/lib/meeting-config-service";

const createSchema = z.object({
  name: z.string().min(1).max(100),
  location: z.string().max(200).optional().nullable(),
});

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

  const areas = await listMeetingAreas(eventId);
  return createSuccessResponse({ areas });
});

export const POST = withErrorHandler(async (request, context) => {
  const eventId = context?.params?.eventId;
  if (!eventId) {
    return createErrorResponse("缺少活动 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  await requireEventAccess(eventId);
  const forbidden = await assertMeetingHostEvent(eventId);
  if (forbidden) return forbidden;

  const body = await request.json().catch(() => ({}));
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return createErrorResponse("参数错误", ErrorCode.VALIDATION_ERROR, 400);
  }

  const area = await createMeetingArea(eventId, parsed.data);
  return createSuccessResponse(area);
});

export const DELETE = withErrorHandler(async (request, context) => {
  const eventId = context?.params?.eventId;
  if (!eventId) {
    return createErrorResponse("缺少活动 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  await requireEventAccess(eventId);
  const forbidden = await assertMeetingHostEvent(eventId);
  if (forbidden) return forbidden;

  const { searchParams } = new URL(request.url);
  const areaId = searchParams.get("id");
  if (!areaId) {
    return createErrorResponse("缺少会面区 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  try {
    await deleteMeetingArea(eventId, areaId);
  } catch {
    return createErrorResponse("会面区不存在", ErrorCode.NOT_FOUND, 404);
  }

  return createSuccessResponse({ deleted: true });
});
