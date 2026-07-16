import { cacheGet, cacheSet, cacheTtl } from "@/lib/redis";

/** 兑换入口限流：每 IP 每分钟最多 N 次 */
const RESOLVE_LIMIT = 60;
const RESOLVE_WINDOW_SEC = 60;

export async function assertInviteEntryResolveRateLimit(
  ip: string,
): Promise<{ ok: true } | { ok: false; retryAfter: number }> {
  const key = `invite:entry-resolve:${ip || "unknown"}`;
  const ttl = await cacheTtl(key);
  const raw = await cacheGet(key);
  const count = raw ? Number(raw) : 0;

  if (count >= RESOLVE_LIMIT && ttl > 0) {
    return { ok: false, retryAfter: ttl };
  }

  const next = (Number.isFinite(count) ? count : 0) + 1;
  const expire = ttl > 0 ? ttl : RESOLVE_WINDOW_SEC;
  await cacheSet(key, String(next), expire);
  return { ok: true };
}

export function clientIpFromRequest(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}
