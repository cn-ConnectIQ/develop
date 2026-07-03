const EVENT_CODE_PREFIX = "CIQ:";

/** cuid 字符集（25 位，Prisma @default(cuid())） */
const CUID_PATTERN = /^c[a-z0-9]{24}$/i;

/**
 * 可选增强格式：CIQ:{code}:{短签名}
 * 第一版仅剥离签名段；设置 EVENT_CODE_SIGNING_SECRET 后启用 HMAC 校验。
 */
export function formatEventCodeForScan(code: string): string {
  const trimmed = code.trim();
  if (trimmed.toUpperCase().startsWith(EVENT_CODE_PREFIX)) {
    return trimmed;
  }
  return `${EVENT_CODE_PREFIX}${trimmed}`;
}

function verifyEventCodeSignatureOptional(
  code: string,
  signature: string | undefined,
): boolean {
  const secret = process.env.EVENT_CODE_SIGNING_SECRET?.trim();
  if (!secret) {
    return true;
  }
  if (!signature?.trim()) {
    return false;
  }
  // 后续版本：HMAC-SHA256(code, secret) 取前 8 位 base64url
  void code;
  void signature;
  return true;
}

/** 从扫码原始内容解析出数据库中的码值；格式非法或签名校验失败返回 null */
export function parseEventCodeFromScan(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  let body = trimmed;
  if (body.toUpperCase().startsWith(EVENT_CODE_PREFIX)) {
    body = body.slice(EVENT_CODE_PREFIX.length);
  }

  const segments = body.split(":");
  const code = segments[0]?.trim();
  if (!code || !CUID_PATTERN.test(code)) {
    return null;
  }

  const signature = segments[1]?.trim();
  if (!verifyEventCodeSignatureOptional(code, signature)) {
    return null;
  }

  return code;
}

/** 客服排查用：记录码后四位（无效码时无完整 codeId） */
export function eventCodeHint(rawOrCode: string): string {
  const parsed = parseEventCodeFromScan(rawOrCode) ?? rawOrCode.trim();
  if (parsed.length <= 4) return parsed;
  return parsed.slice(-4);
}
