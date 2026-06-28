export type IntentFieldConfig = {
  enabled: boolean;
  allow_custom: boolean;
};

export type EventIntentConfig = {
  supply: IntentFieldConfig;
  demand: IntentFieldConfig;
  role: IntentFieldConfig & { options: string[] };
  topics: IntentFieldConfig;
  premeet_days_before: number;
  premeet_reminder_enabled: boolean;
  premeet_reminder_days: number;
  premeet_reminder_message: string;
};

export const DEFAULT_INTENT_CONFIG: EventIntentConfig = {
  supply: { enabled: true, allow_custom: true },
  demand: { enabled: true, allow_custom: true },
  role: {
    enabled: true,
    allow_custom: false,
    options: ["采购", "销售", "投资", "合作", "学习交流"],
  },
  topics: { enabled: true, allow_custom: true },
  premeet_days_before: 7,
  premeet_reminder_enabled: true,
  premeet_reminder_days: 3,
  premeet_reminder_message: "{match_count} 位高匹配嘉宾已确认参加，去看看",
};

export type MatchReasonItem = {
  type:
    | "supply_demand"
    | "demand_supply"
    | "bidirectional"
    | "shared_topic"
    | "shared_role"
    | "signal"
    | "industry"
    | "semantic";
  label: string;
  detail?: string;
};

export function parseIntentConfig(raw: unknown): EventIntentConfig {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_INTENT_CONFIG };
  const obj = raw as Record<string, unknown>;
  return {
    supply: {
      enabled: boolField(obj.supply, "enabled", DEFAULT_INTENT_CONFIG.supply.enabled),
      allow_custom: boolField(
        obj.supply,
        "allow_custom",
        DEFAULT_INTENT_CONFIG.supply.allow_custom,
      ),
    },
    demand: {
      enabled: boolField(obj.demand, "enabled", DEFAULT_INTENT_CONFIG.demand.enabled),
      allow_custom: boolField(
        obj.demand,
        "allow_custom",
        DEFAULT_INTENT_CONFIG.demand.allow_custom,
      ),
    },
    role: {
      enabled: boolField(obj.role, "enabled", DEFAULT_INTENT_CONFIG.role.enabled),
      allow_custom: boolField(
        obj.role,
        "allow_custom",
        DEFAULT_INTENT_CONFIG.role.allow_custom,
      ),
      options: stringArrayField(obj.role, "options", DEFAULT_INTENT_CONFIG.role.options),
    },
    topics: {
      enabled: boolField(obj.topics, "enabled", DEFAULT_INTENT_CONFIG.topics.enabled),
      allow_custom: boolField(
        obj.topics,
        "allow_custom",
        DEFAULT_INTENT_CONFIG.topics.allow_custom,
      ),
    },
    premeet_days_before: numField(
      obj,
      "premeet_days_before",
      DEFAULT_INTENT_CONFIG.premeet_days_before,
    ),
    premeet_reminder_enabled: boolField(
      obj,
      "premeet_reminder_enabled",
      DEFAULT_INTENT_CONFIG.premeet_reminder_enabled,
    ),
    premeet_reminder_days: numField(
      obj,
      "premeet_reminder_days",
      DEFAULT_INTENT_CONFIG.premeet_reminder_days,
    ),
    premeet_reminder_message: strField(
      obj,
      "premeet_reminder_message",
      DEFAULT_INTENT_CONFIG.premeet_reminder_message,
    ),
  };
}

function boolField(obj: unknown, key: string, fallback: boolean): boolean {
  if (!obj || typeof obj !== "object") return fallback;
  const val = (obj as Record<string, unknown>)[key];
  return typeof val === "boolean" ? val : fallback;
}

function numField(obj: Record<string, unknown>, key: string, fallback: number): number {
  const val = obj[key];
  return typeof val === "number" && Number.isFinite(val) ? val : fallback;
}

function strField(obj: Record<string, unknown>, key: string, fallback: string): string {
  const val = obj[key];
  return typeof val === "string" && val.trim() ? val : fallback;
}

function stringArrayField(obj: unknown, key: string, fallback: string[]): string[] {
  if (!obj || typeof obj !== "object") return fallback;
  const val = (obj as Record<string, unknown>)[key];
  if (!Array.isArray(val)) return fallback;
  return val.filter((v): v is string => typeof v === "string" && v.trim().length > 0);
}

export function formatMatchReasons(items: MatchReasonItem[]): string {
  if (items.length === 0) return "同行业参会者，存在合作潜力";
  return items
    .slice(0, 3)
    .map((r) => r.label)
    .join("；");
}

export function parseMatchReasons(raw: unknown): MatchReasonItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (item): item is MatchReasonItem =>
      !!item &&
      typeof item === "object" &&
      typeof (item as MatchReasonItem).type === "string" &&
      typeof (item as MatchReasonItem).label === "string",
  );
}
