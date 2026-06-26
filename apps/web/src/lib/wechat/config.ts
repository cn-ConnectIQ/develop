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
