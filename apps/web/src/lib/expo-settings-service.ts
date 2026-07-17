import { prisma } from "@connectiq/database";
import {
  DEFAULT_EXPO_BOOTH_TYPES,
  EXPO_SETTING_KEYS,
  parseExpoBoothTypes,
  type ExpoBoothTypesValue,
  type ExpoSettingsPayload,
} from "@/lib/expo-settings-shared";

export {
  DEFAULT_EXPO_BOOTH_TYPES,
  EXPO_SETTING_KEYS,
  normalizeExpoBoothTypesInput,
  parseExpoBoothTypes,
  type ExpoBoothType,
  type ExpoBoothTypesValue,
  type ExpoSettingKey,
  type ExpoSettingsPayload,
  type ExpoSettingsStaff,
} from "@/lib/expo-settings-shared";

export async function getExpoBoothTypes(
  eventId: string,
): Promise<ExpoBoothTypesValue> {
  const row = await prisma.eventSetting.findUnique({
    where: { eventId_key: { eventId, key: "expo_booth_types" } },
  });
  const raw =
    row?.value && typeof row.value === "object" && !Array.isArray(row.value)
      ? (row.value as Record<string, unknown>)
      : null;
  return parseExpoBoothTypes(raw);
}

export async function assertHallLabelAllowed(
  eventId: string,
  hallLabel: string | null | undefined,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (hallLabel == null || hallLabel.trim() === "") {
    return { ok: true };
  }
  const name = hallLabel.trim();
  const catalog = await getExpoBoothTypes(eventId);
  if (!catalog.types.some((t) => t.name === name)) {
    return {
      ok: false,
      error: `展位类型「${name}」未在展会配置中定义，请先到展会配置添加`,
    };
  }
  return { ok: true };
}

export async function getExpoSettings(eventId: string) {
  const rows = await prisma.eventSetting.findMany({
    where: {
      eventId,
      key: { in: [...EXPO_SETTING_KEYS] },
    },
  });
  const map: Record<string, Record<string, unknown>> = {};
  for (const row of rows) {
    if (row.value && typeof row.value === "object" && !Array.isArray(row.value)) {
      map[row.key] = row.value as Record<string, unknown>;
    }
  }
  // 未落库时也返回默认展位类型，便于前端下拉直接使用
  if (!map.expo_booth_types) {
    map.expo_booth_types = {
      types: DEFAULT_EXPO_BOOTH_TYPES.map((t) => ({ ...t })),
    };
  } else {
    map.expo_booth_types = parseExpoBoothTypes(
      map.expo_booth_types,
    ) as unknown as Record<string, unknown>;
  }
  return map;
}

export async function loadExpoSettingsPayload(
  eventId: string,
): Promise<ExpoSettingsPayload> {
  const [settings, event] = await Promise.all([
    getExpoSettings(eventId),
    prisma.event.findUnique({
      where: { id: eventId },
      select: {
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
    }),
  ]);

  return {
    settings,
    staff: event?.org?.staff ?? [],
  };
}
