export type StampPointType =
  | "BOOTH"
  | "SPONSOR_AREA"
  | "SESSION"
  | "PHOTO_WALL"
  | "CUSTOM";

export const STAMP_POINT_TYPE_LABELS: Record<StampPointType, string> = {
  BOOTH: "展位",
  SPONSOR_AREA: "赞助商区域",
  SESSION: "分会场/议题",
  PHOTO_WALL: "合影打卡台",
  CUSTOM: "自定义",
};

/** 非展位打卡点可选类型（配置 UI 下拉） */
export const CUSTOM_STAMP_POINT_TYPES: StampPointType[] = [
  "SPONSOR_AREA",
  "SESSION",
  "PHOTO_WALL",
  "CUSTOM",
];

export type StampPointConfig = {
  point_type: StampPointType;
  booth_id?: string | null;
  custom_name?: string | null;
  location?: string | null;
  name: string;
  icon?: string | null;
  weight: number;
  required: boolean;
  /** 编辑时用于稳定匹配已有 Stamp 行 */
  stamp_id?: string | null;
  /** 前端列表稳定 key（不随名称/类型变更） */
  client_id?: string;
};

/** @deprecated 使用 StampPointConfig */
export type BoothStampConfig = StampPointConfig;

export type StampRallyMeta = {
  prize_quantity?: number | null;
  booth_stamps: StampPointConfig[];
};

export type StampRallyFormPayload = {
  name: string;
  description?: string | null;
  cover_image?: string | null;
  prize: string;
  prize_image_url?: string | null;
  prize_desc?: string | null;
  prize_quantity?: number | null;
  required_count: number;
  booth_ids: string[];
  booth_stamps?: StampPointConfig[];
  starts_at?: string | null;
  ends_at?: string | null;
  always_open?: boolean;
  status?: "DRAFT" | "ACTIVE" | "ENDED";
};

export const STAMP_EMOJI_OPTIONS = [
  "🏢",
  "⭐",
  "🎁",
  "🔥",
  "💎",
  "🎯",
  "✨",
  "🏆",
  "📍",
  "🛍️",
  "🤝",
  "💡",
  "📸",
  "🎤",
  "🎪",
] as const;

export function isBoothStampPoint(cfg: StampPointConfig): boolean {
  return cfg.point_type === "BOOTH" || (!cfg.point_type && Boolean(cfg.booth_id));
}

function createStampClientId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `stamp_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function resolveStampClientId(
  raw: Partial<StampPointConfig>,
  pointType: StampPointType,
): string {
  if (raw.client_id) return raw.client_id;
  if (raw.stamp_id) return raw.stamp_id;
  if (pointType === "BOOTH" && raw.booth_id) return `booth:${raw.booth_id}`;
  return createStampClientId();
}

export function normalizeStampPoint(raw: Partial<StampPointConfig>): StampPointConfig {
  const pointType =
    raw.point_type ??
    (raw.booth_id ? "BOOTH" : "CUSTOM");
  const customName =
    raw.custom_name?.trim() ||
    (!isBoothStampPoint({ ...raw, point_type: pointType } as StampPointConfig)
      ? raw.name?.trim() || null
      : null);

  return {
    point_type: pointType,
    booth_id: pointType === "BOOTH" ? raw.booth_id ?? null : null,
    custom_name: customName,
    location: raw.location?.trim() || null,
    name: raw.name?.trim() || customName || raw.booth_id || "打卡点",
    icon: raw.icon ?? "⭐",
    weight: raw.weight ?? 1,
    required: raw.required ?? true,
    stamp_id: raw.stamp_id ?? null,
    client_id: resolveStampClientId(raw, pointType),
  };
}

export function normalizeStampPoints(
  raw: Partial<StampPointConfig>[] | undefined,
): StampPointConfig[] {
  if (!raw?.length) return [];
  return raw.map((item) => normalizeStampPoint(item));
}

export function stampPointClientKey(cfg: StampPointConfig): string {
  if (cfg.client_id) return cfg.client_id;
  if (cfg.stamp_id) return `id:${cfg.stamp_id}`;
  if (isBoothStampPoint(cfg) && cfg.booth_id) return `booth:${cfg.booth_id}`;
  return createStampClientId();
}

export function extractBoothIdsFromStampPoints(
  points: StampPointConfig[],
): string[] {
  return points
    .filter((p) => isBoothStampPoint(p) && p.booth_id)
    .map((p) => p.booth_id!)
    .filter(Boolean);
}

export function buildDefaultBoothStamp(
  boothId: string,
  boothCode: string,
  companyName: string,
): StampPointConfig {
  return {
    point_type: "BOOTH",
    booth_id: boothId,
    custom_name: null,
    location: null,
    name: `${boothCode} ${companyName}`.slice(0, 40),
    icon: "⭐",
    weight: 1,
    required: true,
    client_id: `booth:${boothId}`,
  };
}

export function buildDefaultCustomStamp(
  pointType: Exclude<StampPointType, "BOOTH"> = "CUSTOM",
): StampPointConfig {
  return {
    point_type: pointType,
    booth_id: null,
    custom_name: "",
    location: null,
    name: "",
    icon: "📍",
    weight: 1,
    required: true,
    client_id: createStampClientId(),
  };
}

export function computeWeightedRequired(stamps: StampPointConfig[]): number {
  const requiredStamps = stamps.filter((s) => s.required);
  if (requiredStamps.length === 0) {
    return stamps.reduce((sum, s) => sum + s.weight, 0);
  }
  return requiredStamps.reduce((sum, s) => sum + s.weight, 0);
}

export function displayStampPointLabel(cfg: StampPointConfig): string {
  if (isBoothStampPoint(cfg)) return cfg.name;
  return cfg.custom_name?.trim() || cfg.name;
}
