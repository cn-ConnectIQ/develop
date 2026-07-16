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
 * Next.js basePath=/uc；入口 uc-path-proxy 在进 Next 前补回 /uc。
 * （Next 16 不允许用 rewrites 把 basePath 外路径 rewrite 进来。）
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
  serverExternalPackages: ["pg", "@prisma/adapter-pg", "bcryptjs", "qiniu"],
};

export default nextConfig;
