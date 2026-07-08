import type { NextConfig } from "next";

/**
 * CloudBase 自定义域名路由 /uc 会在网关层剥掉前缀再转发到容器（/uc/login → /login）。
 * 因此容器内 Next.js 不应再设 basePath；对外 URL 仍用 NEXT_PUBLIC_APP_URL=https://9li.co/uc
 */
const basePath = process.env.NEXT_BASE_PATH?.trim() ?? "";

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
