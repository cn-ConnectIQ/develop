import { cacheDel, cacheGet, cacheSet } from "@/lib/redis";
import { getWxMpCredentials } from "@/lib/wechat/config";

const TOKEN_TTL_SECONDS = 7000;

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
  return `wechat:mp:access_token:${appId}`;
}

async function fetchAccessTokenFromWechat(appId: string, secret: string) {
  const url = new URL("https://api.weixin.qq.com/cgi-bin/token");
  url.searchParams.set("grant_type", "client_credential");
  url.searchParams.set("appid", appId);
  url.searchParams.set("secret", secret);

  const res = await fetch(url.toString());
  const data = (await res.json()) as WechatTokenResponse;
  if (!data.access_token) {
    throw new Error(
      data.errmsg ?? `服务号 access_token 失败 (${data.errcode ?? "unknown"})`,
    );
  }
  return {
    access_token: data.access_token,
    expires_in: data.expires_in ?? 7200,
  };
}

export async function getWxMpAccessToken(options?: {
  forceRefresh?: boolean;
}): Promise<string> {
  const creds = getWxMpCredentials();
  if (!creds) {
    if (process.env.NODE_ENV === "development") {
      return "dev-wechat-mp-access-token";
    }
    throw new Error("服务号未配置 WX_MP_APPID / WX_MP_SECRET");
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
        if (cached.length > 20) return cached;
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

export async function withWxMpAccessToken<T>(
  fn: (token: string) => Promise<T>,
): Promise<T> {
  try {
    return await fn(await getWxMpAccessToken());
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/40001|42001|invalid credential|access_token expired/i.test(message)) {
      const creds = getWxMpCredentials();
      if (creds) await cacheDel(cacheKey(creds.appId));
      return fn(await getWxMpAccessToken({ forceRefresh: true }));
    }
    throw err;
  }
}
