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
  EXPO_SETTING_KEYS,
  getExpoSettings,
  loadExpoSettingsPayload,
  normalizeExpoBoothTypesInput,
} from "@/lib/expo-settings-service";

export {
  getExpoSettings,
  type ExpoSettingKey,
} from "@/lib/expo-settings-service";

const patchSchema = z.record(z.string(), z.unknown());

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

  for (const key of EXPO_SETTING_KEYS) {
    if (!(key in parsed.data)) continue;

    if (key === "expo_booth_types") {
      const normalized = normalizeExpoBoothTypesInput(parsed.data[key]);
      if (!normalized.ok) {
        return createErrorResponse(
          normalized.error,
          ErrorCode.VALIDATION_ERROR,
          400,
        );
      }

      const existing = await prisma.exhibitorBooth.findMany({
        where: {
          eventId,
          hallLabel: { not: null },
        },
        select: { hallLabel: true },
      });
      const inUse = new Set(
        existing
          .map((b) => b.hallLabel?.trim())
          .filter((v): v is string => Boolean(v)),
      );
      const nextNames = new Set(normalized.value.types.map((t) => t.name));
      const blocked = [...inUse].filter((name) => !nextNames.has(name));
      if (blocked.length > 0) {
        const counts = await Promise.all(
          blocked.map(async (name) => {
            const n = await prisma.exhibitorBooth.count({
              where: { eventId, hallLabel: name },
            });
            return { name, n };
          }),
        );
        const detail = counts
          .filter((c) => c.n > 0)
          .map((c) => `「${c.name}」仍有 ${c.n} 个展位使用`)
          .join("；");
        return createErrorResponse(
          detail
            ? `无法删除已被占用的展位类型：${detail}`
            : "无法删除已被占用的展位类型",
          ErrorCode.VALIDATION_ERROR,
          400,
        );
      }

      await prisma.eventSetting.upsert({
        where: { eventId_key: { eventId, key } },
        create: { eventId, key, value: normalized.value },
        update: { value: normalized.value },
      });
      continue;
    }

    await prisma.eventSetting.upsert({
      where: { eventId_key: { eventId, key } },
      create: { eventId, key, value: parsed.data[key] as object },
      update: { value: parsed.data[key] as object },
    });
  }

  const settings = await getExpoSettings(eventId);
  return createSuccessResponse({ settings });
});
