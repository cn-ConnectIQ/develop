import type { LeadFormField, LeadFormUserPrefill } from "./types";

export function resolvePrefillValue(
  source: LeadFormField["prefill_from"],
  user: LeadFormUserPrefill,
): string {
  if (!source) return "";
  switch (source) {
    case "user.name":
      return user.name?.trim() ?? "";
    case "user.phone":
      return user.phone?.trim() ?? "";
    case "user.company":
      return user.company?.trim() ?? "";
    case "user.title":
      return user.title?.trim() ?? "";
    default:
      return "";
  }
}

export function buildPrefilledValues(
  fields: LeadFormField[],
  user: LeadFormUserPrefill,
): Record<string, string> {
  const values: Record<string, string> = {};
  for (const field of fields) {
    if (field.prefill_from) {
      const v = resolvePrefillValue(field.prefill_from, user);
      if (v) values[field.id] = v;
    }
  }
  return values;
}
