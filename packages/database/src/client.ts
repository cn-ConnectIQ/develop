import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

function getConnectionString() {
  // Session Pooler（5432）优先；Transaction Pooler 仅作备选
  const url = process.env.DATABASE_URL ?? process.env.DATABASE_URL_POOLER;
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }

  // pg 与 URL 中的 sslmode 冲突时会导致证书校验失败，由 Pool 统一处理 SSL
  return url
    .replace(/([?&])sslmode=[^&]*(&)?/, (_, prefix, suffix) => {
      if (prefix === "?" && suffix) return "?";
      if (prefix === "?" && !suffix) return "";
      if (prefix === "&" && suffix) return "&";
      return "";
    })
    .replace(/\?$/, "");
}

type DbGlobal = {
  pgPool?: pg.Pool;
  prisma?: PrismaClient;
};

const globalForDb = globalThis as unknown as DbGlobal;

function createPool() {
  const max = Number(process.env.DATABASE_POOL_MAX ?? 5);
  return new pg.Pool({
    connectionString: getConnectionString(),
    ssl: { rejectUnauthorized: false },
    max,
    idleTimeoutMillis: 20_000,
    connectionTimeoutMillis: 30_000,
  });
}

const pool = globalForDb.pgPool ?? createPool();
if (process.env.NODE_ENV !== "production") {
  globalForDb.pgPool = pool;
}

const adapter = new PrismaPg(pool);

export const prisma =
  globalForDb.prisma ??
  new PrismaClient({
    adapter,
    log: process.env.PRISMA_LOG === "1" ? ["error", "warn"] : undefined,
  });

globalForDb.prisma = prisma;
globalForDb.pgPool = pool;
