/**
 * 鉴权 URL 自动对齐当前部署域名。
 * Preview 分支若 NEXTAUTH_URL 仍指向生产域，会导致登录后 session 异常。
 */
export function ensureNextAuthUrl() {
  const vercelUrl = process.env.VERCEL_URL?.trim();
  const vercelEnv = process.env.VERCEL_ENV;

  // Preview / Development 部署强制使用当前 Vercel 域名
  if (vercelUrl && (vercelEnv === "preview" || vercelEnv === "development")) {
    process.env.NEXTAUTH_URL = `https://${vercelUrl}`;
    return;
  }

  if (process.env.NEXTAUTH_URL?.trim()) return;

  if (vercelUrl) {
    process.env.NEXTAUTH_URL = `https://${vercelUrl}`;
  }
}

ensureNextAuthUrl();
