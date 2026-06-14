import { ParticipantRole } from "@connectiq/database";

export function generateBadgeQr(eventId: string): string {
  const prefix = eventId.replace(/[^a-z0-9]/gi, "").slice(0, 8).toLowerCase() || "evt";
  const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  return `${prefix}-${suffix}`;
}

export type ParticipantListItem = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  jobTitle: string | null;
  role: ParticipantRole;
  badgeQr: string | null;
  createdAt: string;
  ticketType: string | null;
  ticketTypeId: string | null;
  checkedInAt: string | null;
  connectionCount: number;
  isVip: boolean;
  isSpeaker: boolean;
  inviteStatus: "NOT_INVITED" | "INVITED" | "CLICKED" | "ACTIVATED";
};

export const IMPORT_SYSTEM_FIELDS = [
  { key: "name", label: "姓名", required: true },
  { key: "phone", label: "手机号", required: true },
  { key: "email", label: "邮箱", required: false },
  { key: "company", label: "公司", required: false },
  { key: "jobTitle", label: "职位", required: false },
] as const;

export type ImportSystemFieldKey = (typeof IMPORT_SYSTEM_FIELDS)[number]["key"];

export type ImportRow = {
  name: string;
  phone?: string;
  email?: string;
  company?: string;
  jobTitle?: string;
};

export const IMPORT_HEADER_ALIASES: Record<ImportSystemFieldKey, string[]> = {
  name: ["姓名", "name", "Name", "参会者", "名称"],
  phone: ["手机", "手机号", "phone", "Phone", "联系电话", "手机号码"],
  email: ["邮箱", "email", "Email", "电子邮箱"],
  company: ["公司", "company", "Company", "单位", "企业"],
  jobTitle: ["职位", "jobTitle", "title", "Title", "职务", "岗位"],
};

export function guessFieldMapping(
  fileHeaders: string[],
): Record<ImportSystemFieldKey, string | null> {
  const mapping = {} as Record<ImportSystemFieldKey, string | null>;
  for (const field of IMPORT_SYSTEM_FIELDS) {
    const alias = IMPORT_HEADER_ALIASES[field.key].find((h) =>
      fileHeaders.includes(h),
    );
    mapping[field.key] = alias ?? null;
  }
  return mapping;
}

export function mapRowsWithFields(
  rawRows: Record<string, string>[],
  mapping: Record<ImportSystemFieldKey, string | null>,
): ImportRow[] {
  return rawRows
    .map((row) => ({
      name: mapping.name ? row[mapping.name]?.trim() ?? "" : "",
      phone: mapping.phone ? row[mapping.phone]?.trim() : undefined,
      email: mapping.email ? row[mapping.email]?.trim() : undefined,
      company: mapping.company ? row[mapping.company]?.trim() : undefined,
      jobTitle: mapping.jobTitle ? row[mapping.jobTitle]?.trim() : undefined,
    }))
    .filter((r) => r.name);
}

export function buildImportTemplateCsv(): string {
  return "姓名,手机,邮箱,公司,职位\n张三,13900000001,zhang@example.com,未来科技,产品总监\n";
}
