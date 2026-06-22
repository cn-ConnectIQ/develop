/** 组织主页 — 行业与规模选项（参考领英公司页） */

export const ORG_INDUSTRY_OPTIONS = [
  "信息技术",
  "互联网",
  "金融与保险",
  "教育",
  "医疗健康",
  "制造业",
  "零售与电商",
  "房地产",
  "咨询与专业服务",
  "媒体与广告",
  "文化娱乐",
  "物流与供应链",
  "能源与环保",
  "政府与公共事业",
  "非营利组织",
  "其他",
] as const;

export type OrgIndustry = (typeof ORG_INDUSTRY_OPTIONS)[number];

export const ORG_COMPANY_SIZE_OPTIONS = [
  { value: "1-10", label: "1-10 人" },
  { value: "11-50", label: "11-50 人" },
  { value: "51-200", label: "51-200 人" },
  { value: "201-500", label: "201-500 人" },
  { value: "501-1000", label: "501-1,000 人" },
  { value: "1001-5000", label: "1,001-5,000 人" },
  { value: "5001+", label: "5,001 人以上" },
] as const;

export type OrgCompanySize = (typeof ORG_COMPANY_SIZE_OPTIONS)[number]["value"];

export function getCompanySizeLabel(value: string | null | undefined) {
  if (!value) return null;
  return ORG_COMPANY_SIZE_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

export function validateFoundedYear(year: number | null | undefined): string | null {
  if (year == null) return null;
  const current = new Date().getFullYear();
  if (!Number.isInteger(year) || year < 1800 || year > current) {
    return `成立年份需在 1800-${current} 之间`;
  }
  return null;
}
