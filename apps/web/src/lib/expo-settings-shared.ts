/** 可在 Client Component 中安全引用的展会配置类型与纯函数（无 DB 依赖） */

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

export type ExpoSettingsStaff = Array<{
  id: string;
  role: string;
  user: { id: string; name: string; phone: string | null };
}>;

export type ExpoSettingsPayload = {
  settings: Record<string, Record<string, unknown>>;
  staff: ExpoSettingsStaff;
};
