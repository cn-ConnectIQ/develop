import { prisma } from "@connectiq/database";
import { ErrorCode } from "@connectiq/types";
import { z } from "zod";
import {
  createErrorResponse,
  createSuccessResponse,
  requireEventAccess,
  withErrorHandler,
} from "@/lib/api-auth";
import {
  getExpoSettings,
  loadExpoSettingsPayload,
} from "@/lib/expo-settings-service";

export { getExpoSettings, type ExpoSettingKey } from "@/lib/expo-settings-service";

const patchSchema = z.record(z.string(), z.unknown());

const EXPO_KEYS = [
  "expo_registration",
  "expo_buyer",
  "expo_matching",
  "expo_notifications",
] as const;

export const GET = withErrorHandler(async (_request, context) => {
  const eventId = context?.params?.eventId;
  if (!eventId) {
    return createErrorResponse("缺少活动 ID", ErrorCode.VALIDATION_ERROR, 400);
  }
  await requireEventAccess(eventId);

  const data = await loadExpoSettingsPayload(eventId);
  return createSuccessResponse(data);
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
