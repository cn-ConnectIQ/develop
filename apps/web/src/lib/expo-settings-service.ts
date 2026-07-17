import { prisma } from "@connectiq/database";

const EXPO_KEYS = [
  "expo_registration",
  "expo_buyer",
  "expo_matching",
  "expo_notifications",
  "expo_booth_types",
] as const;

export type ExpoSettingKey = (typeof EXPO_KEYS)[number];

export const EXPO_SETTING_KEYS = EXPO_KEYS;

export type ExpoBoothType = {
  name: string;
  defaultMaxStaffCount: number;
};

export type ExpoBoothTypesValue = {
  types: ExpoBoothType[];
};

export const DEFAULT_EXPO_BOOTH_TYPES: ExpoBoothType[] = [
  { name: "标准展位", defaultMaxStaffCount: 2 },
  { name: "大展位", defaultMaxStaffCount: 5 },
  { name: "VIP", defaultMaxStaffCount: 10 },
];

export function parseExpoBoothTypes(
  raw: Record<string, unknown> | undefined | null,
): ExpoBoothTypesValue {
  const typesRaw = raw?.types;
  if (!Array.isArray(typesRaw) || typesRaw.length === 0) {
    return { types: DEFAULT_EXPO_BOOTH_TYPES.map((t) => ({ ...t })) };
  }

  const types: ExpoBoothType[] = [];
  const seen = new Set<string>();
  for (const item of typesRaw) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const row = item as Record<string, unknown>;
    const name = String(row.name ?? "").trim();
    if (!name || seen.has(name)) continue;
    seen.add(name);
    const max = Number(row.defaultMaxStaffCount);
    types.push({
      name,
      defaultMaxStaffCount: Number.isFinite(max)
        ? Math.max(1, Math.min(99, Math.round(max)))
        : 2,
    });
  }

  if (types.length === 0) {
    return { types: DEFAULT_EXPO_BOOTH_TYPES.map((t) => ({ ...t })) };
  }
  return { types };
}

/** 规范化并校验待保存的展位类型目录 */
export function normalizeExpoBoothTypesInput(
  value: unknown,
): { ok: true; value: ExpoBoothTypesValue } | { ok: false; error: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, error: "展位类型配置格式错误" };
  }
  const typesRaw = (value as { types?: unknown }).types;
  if (!Array.isArray(typesRaw)) {
    return { ok: false, error: "展位类型列表格式错误" };
  }
  if (typesRaw.length === 0) {
    return { ok: false, error: "请至少保留一种展位类型" };
  }

  const types: ExpoBoothType[] = [];
  const seen = new Set<string>();
  for (const item of typesRaw) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return { ok: false, error: "展位类型项格式错误" };
    }
    const row = item as Record<string, unknown>;
    const name = String(row.name ?? "").trim();
    if (!name) {
      return { ok: false, error: "展位类型名称不能为空" };
    }
    if (name.length > 64) {
      return { ok: false, error: "展位类型名称过长" };
    }
    if (seen.has(name)) {
      return { ok: false, error: `展位类型「${name}」重复` };
    }
    seen.add(name);
    const max = Number(row.defaultMaxStaffCount);
    if (!Number.isFinite(max) || max < 1 || max > 99) {
      return {
        ok: false,
        error: `「${name}」的默认名额须为 1–99`,
      };
    }
    types.push({
      name,
      defaultMaxStaffCount: Math.round(max),
    });
  }

  return { ok: true, value: { types } };
}

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

export type ExpoSettingsStaff = Array<{
  id: string;
  role: string;
  user: { id: string; name: string; phone: string | null };
}>;

export type ExpoSettingsPayload = {
  settings: Record<string, Record<string, unknown>>;
  staff: ExpoSettingsStaff;
};

export async function getExpoSettings(eventId: string) {
  const rows = await prisma.eventSetting.findMany({
    where: {
      eventId,
      key: { in: [...EXPO_KEYS] },
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
