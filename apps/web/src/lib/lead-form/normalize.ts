import type { LeadFormConfig, LeadFormField } from "./types";

function normalizeField(raw: unknown, index: number): LeadFormField | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const type = row.type;
  if (
    type !== "text" &&
    type !== "phone" &&
    type !== "email" &&
    type !== "select" &&
    type !== "multiselect" &&
    type !== "textarea"
  ) {
    return null;
  }

  const id = typeof row.id === "string" ? row.id : `field_${index}`;
  const label = typeof row.label === "string" ? row.label : "未命名字段";

  const prefill = row.prefill_from ?? row.prefillFrom;
  const allowedPrefill = ["user.name", "user.phone", "user.company", "user.title"];
  const prefill_from =
    typeof prefill === "string" && allowedPrefill.includes(prefill)
      ? (prefill as LeadFormField["prefill_from"])
      : undefined;

  return {
    id,
    type,
    label,
    placeholder: typeof row.placeholder === "string" ? row.placeholder : undefined,
    required: Boolean(row.required),
    options: Array.isArray(row.options)
      ? row.options.filter((o): o is string => typeof o === "string")
      : undefined,
    prefill_from,
    sortOrder:
      typeof row.sortOrder === "number"
        ? row.sortOrder
        : typeof row.sort_order === "number"
          ? row.sort_order
          : index,
  };
}

/** 解析 Lottery.lead_form_config / 展位 form config */
export function normalizeLeadFormConfig(raw: unknown): LeadFormConfig {
  if (!raw) return { fields: [] };

  if (Array.isArray(raw)) {
    const fields = raw
      .map((item, i) => normalizeField(item, i))
      .filter((f): f is LeadFormField => f != null)
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    return { fields };
  }

  if (typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    if (Array.isArray(obj.fields)) {
      const fields = obj.fields
        .map((item, i) => normalizeField(item, i))
        .filter((f): f is LeadFormField => f != null)
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
      return { fields };
    }
  }

  return { fields: [] };
}

export function serializeLeadFormConfig(config: LeadFormConfig): LeadFormConfig {
  return {
    fields: config.fields.map((field, index) => ({
      ...field,
      sortOrder: index,
    })),
  };
}
