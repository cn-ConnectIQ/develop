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
  createMeetingTables,
  deleteMeetingTable,
} from "@/lib/meeting-config-service";

const createSchema = z.object({
  area_id: z.string().cuid(),
  name: z.string().min(1).max(50).optional(),
  capacity: z.number().int().min(1).max(20).optional(),
  bulk_count: z.number().int().min(1).max(50).optional(),
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

  try {
    const tables = await createMeetingTables(eventId, parsed.data);
    return createSuccessResponse({ tables });
  } catch {
    return createErrorResponse("会面区不存在", ErrorCode.NOT_FOUND, 404);
  }
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
  const tableId = searchParams.get("id");
  if (!tableId) {
    return createErrorResponse("缺少桌位 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  try {
    await deleteMeetingTable(eventId, tableId);
  } catch {
    return createErrorResponse("桌位不存在", ErrorCode.NOT_FOUND, 404);
  }

  return createSuccessResponse({ deleted: true });
});
