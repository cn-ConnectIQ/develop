export function normalizeVerificationCode(raw: string): string {
  return raw.trim().toUpperCase();
}

/** 从扫码结果或手动输入中提取核销码 */
export function extractVerificationCode(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";

  try {
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
      const url = new URL(trimmed);
      const pathParts = url.pathname.split("/").filter(Boolean);
      const verifyIdx = pathParts.indexOf("verify");
      if (verifyIdx >= 0 && pathParts[verifyIdx + 1]) {
        return normalizeVerificationCode(pathParts[verifyIdx + 1]!);
      }
      const codeParam = url.searchParams.get("code");
      if (codeParam) return normalizeVerificationCode(codeParam);
    }
  } catch {
    // not a URL
  }

  if (trimmed.includes("code=")) {
    const match = trimmed.match(/code=([A-Za-z0-9-]+)/i);
    if (match?.[1]) return normalizeVerificationCode(match[1]);
  }

  return normalizeVerificationCode(trimmed);
}
