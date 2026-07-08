import type { NextConfig } from "next";

/** CloudBase 独立域名 9li.co 挂载在 /uc；本地 dev 默认不设前缀 */
const basePath =
  process.env.NEXT_BASE_PATH !== undefined
    ? process.env.NEXT_BASE_PATH
    : process.env.NODE_ENV === "production"
      ? "/uc"
      : "";

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
