import { cacheDel, cacheGet, cacheSet } from "@/lib/redis";
import { getWxMiniCredentials } from "@/lib/wechat/config";

const TOKEN_TTL_SECONDS = 7000; // 微信 7200s，预留刷新窗口

type TokenCachePayload = {
  access_token: string;
  expires_at: number;
};

type WechatTokenResponse = {
  access_token?: string;
  expires_in?: number;
  errcode?: number;
  errmsg?: string;
};

function cacheKey(appId: string) {
  return `wechat:access_token:${appId}`;
}

async function fetchAccessTokenFromWechat(
  appId: string,
  secret: string,
): Promise<{ access_token: string; expires_in: number }> {
  const url = new URL("https://api.weixin.qq.com/cgi-bin/token");
  url.searchParams.set("grant_type", "client_credential");
  url.searchParams.set("appid", appId);
  url.searchParams.set("secret", secret);

  const res = await fetch(url.toString());
  const data = (await res.json()) as WechatTokenResponse;

  if (!data.access_token) {
    throw new Error(data.errmsg ?? `获取 access_token 失败 (${data.errcode ?? "unknown"})`);
  }

  return {
    access_token: data.access_token,
    expires_in: data.expires_in ?? 7200,
  };
}

/** 获取并缓存微信小程序 access_token（Redis 优先，降级内存） */
export async function getWechatAccessToken(options?: {
  forceRefresh?: boolean;
}): Promise<string> {
  const creds = getWxMiniCredentials();
  if (!creds) {
    if (process.env.NODE_ENV === "development") {
      return "dev-wechat-access-token";
    }
    throw new Error("微信未配置 WX_MINI_APPID / WX_MINI_SECRET");
  }

  const key = cacheKey(creds.appId);

  if (!options?.forceRefresh) {
    const cached = await cacheGet(key);
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as TokenCachePayload;
        if (parsed.access_token && parsed.expires_at > Date.now() + 60_000) {
          return parsed.access_token;
        }
      } catch {
        // 旧格式纯 token 字符串
        if (cached.startsWith("ey") || cached.length > 20) {
          return cached;
        }
      }
    }
  }

  const fresh = await fetchAccessTokenFromWechat(creds.appId, creds.secret);
  const ttl = Math.min(Math.max(fresh.expires_in - 200, 60), TOKEN_TTL_SECONDS);
  const payload: TokenCachePayload = {
    access_token: fresh.access_token,
    expires_at: Date.now() + ttl * 1000,
  };
  await cacheSet(key, JSON.stringify(payload), ttl);
  return fresh.access_token;
}

export async function clearWechatAccessToken(): Promise<void> {
  const creds = getWxMiniCredentials();
  if (!creds) return;
  await cacheDel(cacheKey(creds.appId));
}

/** access_token 失效时（errcode 40001/42001）清缓存并重试一次 */
export async function withWechatAccessToken<T>(
  fn: (token: string) => Promise<T>,
): Promise<T> {
  try {
    return await fn(await getWechatAccessToken());
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/40001|42001|invalid credential|access_token expired/i.test(message)) {
      await clearWechatAccessToken();
      return fn(await getWechatAccessToken({ forceRefresh: true }));
    }
    throw err;
  }
}
