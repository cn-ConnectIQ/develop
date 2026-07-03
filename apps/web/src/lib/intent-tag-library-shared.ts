/** 客户端/服务端共享的意向标签库类型与常量（禁止引入 prisma） */

export const DEFAULT_ROLE_TAG_OPTIONS = [
  "采购方",
  "供应方",
  "投资方",
  "被投方",
  "合作方",
] as const;

export type IntentTagRecord = {
  id: string;
  eventId: string | null;
  label: string;
  slug: string;
  category: string | null;
  pool: string;
  color: string | null;
  sortOrder: number;
  createdAt: string;
};

export type IntentTagLibrary = {
  tags: IntentTagRecord[];
  supply: string[];
  demand: string[];
  roles: string[];
  topics: string[];
};

export function normalizeIntentTagLabels(
  raw: string[] | undefined | null,
): string[] {
  if (!raw?.length) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of raw) {
    const label = item.trim();
    if (!label) continue;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(label);
  }
  return result;
}
