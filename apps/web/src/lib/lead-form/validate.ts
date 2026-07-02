import { ApiError } from "@/lib/api-auth";
import { ErrorCode } from "@connectiq/types";
import type { LeadFormEntry, LeadFormField } from "./types";

const PHONE_RE = /^1[3-9]\d{9}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseMultiselectValue(value: string): string[] {
  const trimmed = value.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.filter((v): v is string => typeof v === "string");
      }
    } catch {
      // fall through
    }
  }
  return trimmed.split(",").map((s) => s.trim()).filter(Boolean);
}

function validateFieldValue(field: LeadFormField, value: string): string | null {
  const trimmed = value.trim();

  if (!trimmed) {
    if (field.required) return `${field.label}为必填项`;
    return null;
  }

  switch (field.type) {
    case "phone":
      if (!PHONE_RE.test(trimmed)) return `${field.label}格式不正确`;
      return null;
    case "email":
      if (!EMAIL_RE.test(trimmed)) return `${field.label}格式不正确`;
      return null;
    case "select": {
      const options = field.options ?? [];
      if (options.length > 0 && !options.includes(trimmed)) {
        return `${field.label}选项无效`;
      }
      return null;
    }
    case "multiselect": {
      const selected = parseMultiselectValue(trimmed);
      if (field.required && selected.length === 0) {
        return `${field.label}为必填项`;
      }
      const options = field.options ?? [];
      if (options.length > 0 && selected.some((v) => !options.includes(v))) {
        return `${field.label}包含无效选项`;
      }
      return null;
    }
    default:
      return null;
  }
}

export function entriesToValueMap(entries: LeadFormEntry[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const entry of entries) {
    if (entry.field_id) map[entry.field_id] = entry.value ?? "";
  }
  return map;
}

export function validateLeadFormEntries(
  fields: LeadFormField[],
  entries: LeadFormEntry[],
): Record<string, string> {
  const values = entriesToValueMap(entries);

  for (const field of fields) {
    const value = values[field.id] ?? "";
    const error = validateFieldValue(field, value);
    if (error) {
      throw new ApiError(error, ErrorCode.VALIDATION_ERROR, 400);
    }
    values[field.id] = value.trim();
  }

  return values;
}
