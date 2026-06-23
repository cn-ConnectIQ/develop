import { prisma } from "@connectiq/database";
import { ErrorCode } from "@connectiq/types";
import { z } from "zod";
import {
  createErrorResponse,
  createSuccessResponse,
  requireAccountAdmin,
  requireEventAccess,
  withErrorHandler,
} from "@/lib/api-auth";

const EXPO_KEYS = [
  "expo_registration",
  "expo_buyer",
  "expo_matching",
  "expo_notifications",
] as const;

export type ExpoSettingKey = (typeof EXPO_KEYS)[number];

export async function getExpoSettings(eventId: string) {
  const rows = await prisma.eventSetting.findMany({
    where: {
      eventId,
      key: { in: [...EXPO_KEYS] },
    },
  });
  const map: Record<string, unknown> = {};
  for (const row of rows) {
    map[row.key] = row.value;
  }
  return map;
}

const patchSchema = z.record(z.string(), z.unknown());

export const GET = withErrorHandler(async (_request, context) => {
  const eventId = context?.params?.eventId;
  if (!eventId) {
    return createErrorResponse("缺少活动 ID", ErrorCode.VALIDATION_ERROR, 400);
  }
  await requireEventAccess(eventId);

  const settings = await getExpoSettings(eventId);
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      name: true,
      orgId: true,
      org: {
        select: {
          staff: {
            include: {
              user: { select: { id: true, name: true, phone: true } },
            },
          },
        },
      },
    },
  });
  if (!event) {
    return createErrorResponse("活动不存在", ErrorCode.NOT_FOUND, 404);
  }
  return createSuccessResponse({
    settings,
    staff: event.org?.staff ?? [],
  });
});

export const PATCH = withErrorHandler(async (request, context) => {
  const eventId = context?.params?.eventId;
  if (!eventId) {
    return createErrorResponse("缺少活动 ID", ErrorCode.VALIDATION_ERROR, 400);
  }
  await requireEventAccess(eventId);

  const body = await request.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return createErrorResponse("参数错误", ErrorCode.VALIDATION_ERROR, 400);
  }

  for (const key of EXPO_KEYS) {
    if (key in parsed.data) {
      await prisma.eventSetting.upsert({
        where: { eventId_key: { eventId, key } },
        create: { eventId, key, value: parsed.data[key] as object },
        update: { value: parsed.data[key] as object },
      });
    }
  }

  const settings = await getExpoSettings(eventId);
  return createSuccessResponse({ settings });
});
