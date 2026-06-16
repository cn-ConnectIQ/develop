import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@connectiq/database",
    "@connectiq/types",
    "@connectiq/utils",
  ],
  serverExternalPackages: ["pg", "@prisma/adapter-pg", "bcryptjs"],
};

export default nextConfig;
