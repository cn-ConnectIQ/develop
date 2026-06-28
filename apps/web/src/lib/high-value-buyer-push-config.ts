import { prisma } from "@connectiq/database";

export const HIGH_VALUE_BUYER_PUSH_SETTING_KEY = "high_value_buyer_push_config";

export type HighValueBuyerPushConfig = {
  a_level_on_lead_capture: boolean;
  b_level_scan_threshold: number;
  cooldown_minutes: number;
  notify_exhibitor: boolean;
  notify_feed: boolean;
};

export const DEFAULT_HIGH_VALUE_BUYER_PUSH_CONFIG: HighValueBuyerPushConfig = {
  a_level_on_lead_capture: true,
  b_level_scan_threshold: 2,
  cooldown_minutes: 60,
  notify_exhibitor: true,
  notify_feed: true,
};

function clampInt(value: unknown, min: number, max: number, fallback: number) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

export function parseHighValueBuyerPushConfig(
  raw: unknown,
): HighValueBuyerPushConfig {
  if (!raw || typeof raw !== "object") {
    return { ...DEFAULT_HIGH_VALUE_BUYER_PUSH_CONFIG };
  }
  const obj = raw as Record<string, unknown>;
  return {
    a_level_on_lead_capture:
      obj.a_level_on_lead_capture !== undefined
        ? Boolean(obj.a_level_on_lead_capture)
        : DEFAULT_HIGH_VALUE_BUYER_PUSH_CONFIG.a_level_on_lead_capture,
    b_level_scan_threshold: clampInt(
      obj.b_level_scan_threshold,
      2,
      10,
      DEFAULT_HIGH_VALUE_BUYER_PUSH_CONFIG.b_level_scan_threshold,
    ),
    cooldown_minutes: clampInt(
      obj.cooldown_minutes,
      15,
      1440,
      DEFAULT_HIGH_VALUE_BUYER_PUSH_CONFIG.cooldown_minutes,
    ),
    notify_exhibitor:
      obj.notify_exhibitor !== undefined
        ? Boolean(obj.notify_exhibitor)
        : DEFAULT_HIGH_VALUE_BUYER_PUSH_CONFIG.notify_exhibitor,
    notify_feed:
      obj.notify_feed !== undefined
        ? Boolean(obj.notify_feed)
        : DEFAULT_HIGH_VALUE_BUYER_PUSH_CONFIG.notify_feed,
  };
}

export async function getHighValueBuyerPushConfig(
  eventId: string,
): Promise<HighValueBuyerPushConfig> {
  const row = await prisma.eventSetting.findUnique({
    where: {
      eventId_key: { eventId, key: HIGH_VALUE_BUYER_PUSH_SETTING_KEY },
    },
    select: { value: true },
  });
  return parseHighValueBuyerPushConfig(row?.value);
}

export async function saveHighValueBuyerPushConfig(
  eventId: string,
  config: HighValueBuyerPushConfig,
): Promise<HighValueBuyerPushConfig> {
  const normalized = parseHighValueBuyerPushConfig(config);
  await prisma.eventSetting.upsert({
    where: {
      eventId_key: { eventId, key: HIGH_VALUE_BUYER_PUSH_SETTING_KEY },
    },
    create: {
      eventId,
      key: HIGH_VALUE_BUYER_PUSH_SETTING_KEY,
      value: normalized,
    },
    update: { value: normalized },
  });
  return normalized;
}
