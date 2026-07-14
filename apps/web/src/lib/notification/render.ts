/** 变量渲染与短信计费字数 */

export function renderTemplate(
  template: string,
  vars: Record<string, string | number | null | undefined>,
): string {
  return template.replace(/\{([^}]+)\}/g, (_m, key: string) => {
    const v = vars[key];
    if (v === undefined || v === null) return "";
    return String(v);
  });
}

/**
 * 短信计费条数：≤70 字单条；超出后按 67 字/条
 * 返回字数（含签名等已在正文内）与预计条数
 */
export function calcSmsSegments(content: string): {
  charCount: number;
  segments: number;
  willSplit: boolean;
} {
  const charCount = [...content].length;
  if (charCount <= 70) {
    return { charCount, segments: 1, willSplit: false };
  }
  const segments = Math.ceil(charCount / 67);
  return { charCount, segments, willSplit: true };
}

export function formatSmsFeeHint(content: string): string | null {
  const { willSplit, segments } = calcSmsSegments(content);
  if (!willSplit) return null;
  return `将拆成 ${segments} 条，费用翻倍`;
}

/** 从姓名推导「李先生」类称谓；无性别信息时用「先生」 */
export function buildHonorific(name: string, gender?: string | null): string {
  const trimmed = name.trim();
  if (!trimmed) return "您好";
  const surname = [...trimmed][0] ?? "";
  const g = (gender ?? "").toLowerCase();
  if (g === "f" || g === "female" || g === "女") return `${surname}女士`;
  if (g.includes("总")) return `${surname}总`;
  return `${surname}先生`;
}

export function countChineseChars(s: string): number {
  return [...s].length;
}

export function assertShortNameValid(shortName: string | null | undefined) {
  const v = (shortName ?? "").trim();
  if (!v) {
    throw new Error("请先在活动设置中填写活动简称（短信必填，≤8 个汉字）");
  }
  if (countChineseChars(v) > 8) {
    throw new Error("活动简称不能超过 8 个汉字");
  }
  return v;
}
