import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

function getRawConnectionUrl() {
  // Vercel / 生产环境优先 Transaction Pooler（6543），避免 Session 模式连接数打满
  const preferPooler =
    process.env.VERCEL === "1" ||
    process.env.USE_DATABASE_POOLER === "1" ||
    process.env.NODE_ENV === "production";
  const url = preferPooler
    ? (process.env.DATABASE_URL_POOLER ?? process.env.DATABASE_URL)
    : (process.env.DATABASE_URL ?? process.env.DATABASE_URL_POOLER);
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }
  return url;
}

function usesDatabaseSsl(url: string) {
  const match = url.match(/[?&]sslmode=([^&]+)/i);
  if (!match) return true;
  const mode = match[1].toLowerCase();
  return mode !== "disable" && mode !== "allow";
}

function getConnectionString() {
  const url = getRawConnectionUrl();

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
  const isServerless = process.env.VERCEL === "1";
  const max = Number(
    process.env.DATABASE_POOL_MAX ?? (isServerless ? 2 : 5),
  );
  const rawUrl = getRawConnectionUrl();
  return new pg.Pool({
    connectionString: getConnectionString(),
    ssl: usesDatabaseSsl(rawUrl) ? { rejectUnauthorized: false } : false,
    max,
    idleTimeoutMillis: 20_000,
    connectionTimeoutMillis: 30_000,
  });
}

function getPool(): pg.Pool {
  if (globalForDb.pgPool) return globalForDb.pgPool;
  const pool = createPool();
  globalForDb.pgPool = pool;
  return pool;
}

function getPrismaClient(): PrismaClient {
  if (globalForDb.prisma) return globalForDb.prisma;
  const adapter = new PrismaPg(getPool());
  const client = new PrismaClient({
    adapter,
    log: process.env.PRISMA_LOG === "1" ? ["error", "warn"] : undefined,
  });
  globalForDb.prisma = client;
  return client;
}

/** 延迟连接，避免 next build 收集路由时因缺少 DATABASE_URL 失败 */
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    const client = getPrismaClient();
    const value = Reflect.get(client, prop, receiver);
    if (typeof value === "function") {
      return (value as (...args: unknown[]) => unknown).bind(client);
    }
    return value;
  },
});
