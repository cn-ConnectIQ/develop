import type { NextConfig } from "next";

function resolveBasePath(): string {
  const explicit = process.env.NEXT_BASE_PATH?.trim();
  if (explicit !== undefined && explicit !== "") {
    return explicit.replace(/\/$/, "");
  }
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!appUrl) return "";
  try {
    const pathname = new URL(appUrl).pathname.replace(/\/$/, "");
    return pathname === "/" ? "" : pathname;
  } catch {
    return "";
  }
}

/**
 * CloudBase 自定义域名 /uc 会在网关剥前缀（/uc/login → /login）。
 * basePath 保证对外 URL/redirect/Link 带 /uc；middleware rewrite 把剥前缀的请求补回。
 */
const basePath = resolveBasePath();

const nextConfig: NextConfig = {
  basePath,
  output: "standalone",
  transpilePackages: [
    "@connectiq/database",
    "@connectiq/types",
    "@connectiq/utils",
  ],
  serverExternalPackages: ["pg", "@prisma/adapter-pg", "bcryptjs"],
};

export default nextConfig;
