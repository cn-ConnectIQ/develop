import type { MarketupFieldMap, MarketupSyncConfig } from "@/types/booth";
import {
  DEFAULT_MARKETUP_SYNC_CONFIG,
  FIXED_MARKETUP_MAP,
} from "@/lib/form-config";

export const MARKETUP_PROVIDER = "marketup";

export const DEFAULT_CUSTOM_FIELD_MAP: Record<string, string> = {
  intentLevel: "线索评级",
  notes: "备注",
  eventName: "来源活动",
};

export const CUSTOM_FIELD_LABELS: Record<string, string> = {
  intentLevel: "意向等级（A/B/C）",
  notes: "展位备注",
  eventName: "活动名称",
};

export const MARKETUP_TARGET_FIELDS = [
  "联系人姓名",
  "手机号",
  "手机号码",
  "公司名称",
  "职位",
  "线索评级",
  "采购预算",
  "备注",
  "来源活动",
  "来源渠道",
  "行业",
] as const;

export type MarketupAutomationType =
  | "welcome_email"
  | "assign_sales_a"
  | "nurture_end";

export function mergeFieldMaps(
  custom: Record<string, string>,
): MarketupFieldMap {
  return { ...FIXED_MARKETUP_MAP, ...custom };
}

export function parsePlatformFieldMap(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ...DEFAULT_CUSTOM_FIELD_MAP };
  }
  return { ...DEFAULT_CUSTOM_FIELD_MAP, ...(value as Record<string, string>) };
}

export function parsePlatformSyncConfig(value: unknown): MarketupSyncConfig {
  if (!value || typeof value !== "object") return DEFAULT_MARKETUP_SYNC_CONFIG;
  const obj = value as MarketupSyncConfig;
  return {
    writeStrategy: obj.writeStrategy ?? "upsert",
    conflictPolicy: obj.conflictPolicy ?? "connectiq",
    triggers: {
      welcomeEmail: obj.triggers?.welcomeEmail ?? true,
      assignSalesOnA: obj.triggers?.assignSalesOnA ?? true,
      nurtureOnEnd: obj.triggers?.nurtureOnEnd ?? true,
    },
  };
}

export function customFieldEntries(fieldMap: Record<string, string>) {
  return Object.entries(fieldMap).filter(
    ([key]) => !Object.keys(FIXED_MARKETUP_MAP).includes(key),
  );
}
