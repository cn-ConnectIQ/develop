/** 微信小程序凭证（优先 WX_MINI_*，兼容 WECHAT_MINI_*） */
export function getWxMiniCredentials(): { appId: string; secret: string } | null {
  const appId =
    process.env.WX_MINI_APPID?.trim() ||
    process.env.WECHAT_MINI_APP_ID?.trim() ||
    "";
  const secret =
    process.env.WX_MINI_SECRET?.trim() ||
    process.env.WECHAT_MINI_APP_SECRET?.trim() ||
    "";
  if (!appId || !secret) return null;
  return { appId, secret };
}

/** 微信服务号凭证 */
export function getWxMpCredentials(): { appId: string; secret: string } | null {
  const appId =
    process.env.WX_MP_APPID?.trim() ||
    process.env.WECHAT_MP_APP_ID?.trim() ||
    "";
  const secret =
    process.env.WX_MP_SECRET?.trim() ||
    process.env.WECHAT_MP_APP_SECRET?.trim() ||
    "";
  if (!appId || !secret) return null;
  return { appId, secret };
}

export function getWxMpCallbackToken(): string | null {
  const token =
    process.env.WX_MP_TOKEN?.trim() || process.env.WECHAT_MP_TOKEN?.trim();
  return token || null;
}

export function getWxMpEncodingAesKey(): string | null {
  const key =
    process.env.WX_MP_ENCODING_AES_KEY?.trim() ||
    process.env.WECHAT_MP_ENCODING_AES_KEY?.trim();
  return key || null;
}

export function getPublicAppUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXTAUTH_URL ??
    "https://marketingprofs.ai"
  ).replace(/\/$/, "");
}

export function getWxMpOAuthRedirectUri(): string {
  return `${getPublicAppUrl()}/api/wechat/mp/oauth/callback`;
}

export function getWxMpCallbackUrl(): string {
  return `${getPublicAppUrl()}/api/wechat/mp/callback`;
}

export function getWxMiniProgramState(): "developer" | "trial" | "formal" {
  const state = process.env.WX_MINI_PROGRAM_STATE?.trim();
  if (state === "developer" || state === "trial" || state === "formal") {
    return state;
  }
  return process.env.NODE_ENV === "production" ? "formal" : "developer";
}

export function getSubscribeTemplateId(
  envKey: string,
  fallbackEnvKey?: string,
): string | null {
  const id = process.env[envKey]?.trim() || (fallbackEnvKey ? process.env[fallbackEnvKey]?.trim() : "");
  return id || null;
}
