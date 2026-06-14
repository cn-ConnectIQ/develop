import Redis from "ioredis";

declare global {
  // eslint-disable-next-line no-var
  var __connectiqRedis: Redis | undefined;
}

const memoryStore = new Map<string, { value: string; expiresAt: number }>();

function memoryGet(key: string) {
  const item = memoryStore.get(key);
  if (!item) return null;
  if (Date.now() > item.expiresAt) {
    memoryStore.delete(key);
    return null;
  }
  return item.value;
}

function memorySet(key: string, value: string, ttlSeconds: number) {
  memoryStore.set(key, {
    value,
    expiresAt: Date.now() + ttlSeconds * 1000,
  });
}

export function getRedis() {
  const url = process.env.REDIS_URL;
  if (!url) return null;

  if (!global.__connectiqRedis) {
    global.__connectiqRedis = new Redis(url, {
      maxRetriesPerRequest: 1,
      lazyConnect: true,
    });
  }

  return global.__connectiqRedis;
}

export async function cacheSet(
  key: string,
  value: string,
  ttlSeconds: number,
) {
  const redis = getRedis();
  if (redis) {
    try {
      if (redis.status !== "ready") await redis.connect();
      await redis.set(key, value, "EX", ttlSeconds);
      return;
    } catch {
      // fall through to memory store in dev
    }
  }
  memorySet(key, value, ttlSeconds);
}

export async function cacheGet(key: string) {
  const redis = getRedis();
  if (redis) {
    try {
      if (redis.status !== "ready") await redis.connect();
      return redis.get(key);
    } catch {
      // fall through
    }
  }
  return memoryGet(key);
}

export async function cacheDel(key: string) {
  const redis = getRedis();
  if (redis) {
    try {
      if (redis.status !== "ready") await redis.connect();
      await redis.del(key);
      return;
    } catch {
      // fall through
    }
  }
  memoryStore.delete(key);
}

export async function cacheTtl(key: string) {
  const redis = getRedis();
  if (redis) {
    try {
      if (redis.status !== "ready") await redis.connect();
      return redis.ttl(key);
    } catch {
      return -1;
    }
  }
  const item = memoryStore.get(key);
  if (!item) return -2;
  return Math.max(0, Math.floor((item.expiresAt - Date.now()) / 1000));
}
