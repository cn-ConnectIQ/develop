/**
 * CloudBase 自定义域名 /uc 会在网关层剥掉前缀再转发（/uc/login → /login）。
 * Next.js 使用 basePath=/uc 生成对外 URL；入口代理补回剥前缀请求。
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

/** 浏览器侧兜底：页面已在 /uc 下时，即使 env 未注入也返回 /uc */
function deriveBasePathFromWindow(): string {
  if (typeof window === "undefined") return "";
  const path = window.location.pathname || "";
  if (path === "/uc" || path.startsWith("/uc/")) return "/uc";
  if (window.location.hostname.includes("9li.co")) return "/uc";
  if (window.location.hostname.includes("tcloudbase.com")) return "/uc";
  return "";
}

export function getPublicBasePath(): string {
  const explicit =
    process.env.NEXT_PUBLIC_BASE_PATH?.trim() ||
    process.env.NEXT_BASE_PATH?.trim();
  if (explicit !== undefined && explicit !== "") {
    return explicit.replace(/\/$/, "");
  }
  return (
    deriveBasePathFromAppUrl(process.env.NEXT_PUBLIC_APP_URL?.trim()) ||
    deriveBasePathFromWindow()
  );
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

/**
 * 展示侧媒体 URL：绝对 http(s)/data/blob 原样返回；
 * 相对路径（如历史 `/uploads/...`）补上 basePath，避免生产 /uc 下打到域名根 COS。
 */
export function resolveMediaUrl(url: string | null | undefined): string {
  if (!url) return "";
  const trimmed = url.trim();
  if (!trimmed) return "";
  if (
    /^https?:\/\//i.test(trimmed) ||
    trimmed.startsWith("data:") ||
    trimmed.startsWith("blob:")
  ) {
    return trimmed;
  }
  return withPublicPath(trimmed.startsWith("/") ? trimmed : `/${trimmed}`);
}

/** 服务端 middleware 兜底：运行阶段未注入 env 时，按域名推断 /uc */
export function getPublicBasePathWithFallback(host?: string): string {
  const configured = getPublicBasePath();
  if (configured) return configured;
  if (
    host &&
    (host.includes(".run.tcloudbase.com") ||
      host.includes("tcloudbase.com") ||
      host.includes("9li.co"))
  ) {
    return "/uc";
  }
  return "";
}

/** NextAuth SessionProvider / signOut 等使用的 API 基路径 */
export function getAuthApiBasePath(): string {
  const base = getPublicBasePath();
  return base ? `${base}/api/auth` : "/api/auth";
}
