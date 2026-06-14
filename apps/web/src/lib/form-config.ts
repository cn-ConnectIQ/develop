import type { FormFieldType, LeadFormConfig, MarketupSyncConfig } from "@/types/booth";

export const SYSTEM_CAPTURE_FIELDS = [
  { key: "name", label: "姓名" },
  { key: "company", label: "公司" },
  { key: "jobTitle", label: "职位" },
  { key: "phone", label: "手机" },
] as const;

export const FIXED_MARKETUP_MAP: Record<string, string> = {
  name: "联系人姓名",
  phone: "手机号码",
  company: "公司名称",
  jobTitle: "职位",
};

export const MARKETUP_FIELD_OPTIONS = [
  "联系人姓名",
  "手机号码",
  "公司名称",
  "职位",
  "线索评级",
  "采购预算",
  "备注",
  "行业",
  "来源渠道",
] as const;

export const FORM_FIELD_TYPE_OPTIONS: Array<{
  type: FormFieldType;
  label: string;
}> = [
  { type: "text", label: "单行文本" },
  { type: "textarea", label: "多行文本" },
  { type: "select", label: "单选题" },
  { type: "multiselect", label: "多选题" },
  { type: "number", label: "数字" },
  { type: "rating", label: "评分（1-5）" },
];

export const TYPE_BADGE_CLASS: Record<FormFieldType, string> = {
  select: "bg-brand-blue-light text-brand-blue",
  multiselect: "bg-brand-green-light text-brand-green",
  text: "bg-gray-100 text-text-muted",
  textarea: "bg-gray-100 text-text-muted",
  number: "bg-gray-100 text-text-muted",
  rating: "bg-brand-amber-light text-brand-amber",
};

export const TYPE_BADGE_LABEL: Record<FormFieldType, string> = {
  select: "单选",
  multiselect: "多选",
  text: "文字",
  textarea: "文字",
  number: "数字",
  rating: "评分",
};

export const DEFAULT_MARKETUP_SYNC_CONFIG: MarketupSyncConfig = {
  writeStrategy: "upsert",
  conflictPolicy: "connectiq",
  triggers: {
    welcomeEmail: false,
    assignSalesOnA: true,
    nurtureOnEnd: true,
  },
};

export function normalizeLeadFormConfig(raw: unknown): LeadFormConfig {
  if (!raw || typeof raw !== "object") {
    return { fields: [], rules: [] };
  }
  const obj = raw as LeadFormConfig;
  return {
    fields: Array.isArray(obj.fields) ? obj.fields : [],
    rules: Array.isArray(obj.rules) ? obj.rules : [],
  };
}

export function buildDefaultFieldMap(config: LeadFormConfig): Record<string, string> {
  const map: Record<string, string> = { ...FIXED_MARKETUP_MAP };
  for (const field of config.fields) {
    if (field.marketupField) {
      map[field.id] = field.marketupField;
    }
  }
  if (config.fields.some((f) => f.id === "intent")) {
    map.intent = map.intent ?? "线索评级";
  }
  return map;
}

export function formatRuleLabel(
  rule: NonNullable<LeadFormConfig["rules"]>[number],
  fields: LeadFormConfig["fields"],
): string {
  const source = fields.find((f) => f.id === rule.sourceFieldId);
  const target = fields.find((f) => f.id === rule.showFieldId);
  return `若 ${source?.label ?? rule.sourceFieldId} = ${rule.sourceValue} → 显示 ${target?.label ?? rule.showFieldId}`;
}

export function isFieldVisible(
  fieldId: string,
  config: LeadFormConfig,
  values: Record<string, string>,
  rulesEnabled: boolean,
): boolean {
  if (!rulesEnabled || !config.rules?.length) return true;
  const hiddenByRule = config.rules.some((rule) => {
    if (rule.showFieldId !== fieldId) return false;
    const sourceValue = values[rule.sourceFieldId] ?? "";
    return sourceValue !== rule.sourceValue;
  });
  return !hiddenByRule;
}
