/**
 * CloudBase 自定义域名 /uc 会在网关层剥掉前缀再转发（/uc/login → /login）。
 * Next.js 使用 basePath=/uc 生成对外 URL；网关剥前缀后由 middleware rewrite 补回。
 */

function deriveBasePathFromAppUrl(appUrl: string | undefined): string {
  if (!appUrl) return "";
  try {
    const pathname = new URL(appUrl).pathname.replace(/\/$/, "");
    return pathname === "/" ? "" : pathname;
  } catch {
    return "";
  }
}

export function getPublicBasePath(): string {
  const explicit = process.env.NEXT_PUBLIC_BASE_PATH?.trim();
  if (explicit !== undefined && explicit !== "") {
    return explicit.replace(/\/$/, "");
  }
  return deriveBasePathFromAppUrl(process.env.NEXT_PUBLIC_APP_URL?.trim());
}

/** 浏览器侧绝对路径（含 /uc 等子路径前缀） */
export function withPublicPath(path: string): string {
  const base = getPublicBasePath();
  const normalized = path.startsWith("/") ? path : `/${path}`;
  if (!base) return normalized;
  if (normalized === base || normalized.startsWith(`${base}/`)) {
    return normalized;
  }
  return `${base}${normalized}`;
}

/** NextAuth SessionProvider / signOut 等使用的 API 基路径 */
export function getAuthApiBasePath(): string {
  const base = getPublicBasePath();
  return base ? `${base}/api/auth` : "/api/auth";
}
