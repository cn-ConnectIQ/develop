import { createHash, randomBytes } from "crypto";
import { ErrorCode } from "@connectiq/types";
import { ApiError } from "@/lib/api-auth";
import {
  getPublicAppUrl,
  getWxMpCredentials,
  getWxMpOAuthRedirectUri,
} from "@/lib/wechat/config";

export type MpOAuthScope = "snsapi_base" | "snsapi_userinfo";

export type MpOAuthTokenResult = {
  openid: string;
  unionid?: string;
  access_token: string;
  refresh_token?: string;
  scope?: string;
};

type MpOAuthResponse = {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
  openid?: string;
  scope?: string;
  unionid?: string;
  errcode?: number;
  errmsg?: string;
};

export function buildMpOAuthState(payload: Record<string, string>): string {
  const json = JSON.stringify(payload);
  return Buffer.from(json, "utf8").toString("base64url");
}

export function parseMpOAuthState(state: string): Record<string, string> {
  try {
    const json = Buffer.from(state, "base64url").toString("utf8");
    const parsed = JSON.parse(json) as Record<string, string>;
    return parsed ?? {};
  } catch {
    return { raw: state };
  }
}

export function buildMpOAuthUrl(input: {
  redirectPath?: string;
  eventId?: string;
  scope?: MpOAuthScope;
}): string {
  const creds = getWxMpCredentials();
  if (!creds) {
    throw new ApiError("服务号未配置", ErrorCode.WECHAT_NOT_CONFIGURED, 500);
  }

  const redirectUri = encodeURIComponent(getWxMpOAuthRedirectUri());
  const state = buildMpOAuthState({
    nonce: randomBytes(8).toString("hex"),
    redirect: input.redirectPath ?? "/",
    ...(input.eventId ? { eventId: input.eventId } : {}),
  });
  const scope = input.scope ?? "snsapi_base";

  return (
    "https://open.weixin.qq.com/connect/oauth2/authorize" +
    `?appid=${creds.appId}` +
    `&redirect_uri=${redirectUri}` +
    "&response_type=code" +
    `&scope=${scope}` +
    `&state=${encodeURIComponent(state)}` +
    "#wechat_redirect"
  );
}

export async function exchangeMpOAuthCode(
  code: string,
): Promise<MpOAuthTokenResult> {
  const creds = getWxMpCredentials();
  if (!creds) {
    throw new ApiError("服务号未配置", ErrorCode.WECHAT_NOT_CONFIGURED, 500);
  }

  const url = new URL("https://api.weixin.qq.com/sns/oauth2/access_token");
  url.searchParams.set("appid", creds.appId);
  url.searchParams.set("secret", creds.secret);
  url.searchParams.set("code", code);
  url.searchParams.set("grant_type", "authorization_code");

  const res = await fetch(url.toString());
  const data = (await res.json()) as MpOAuthResponse;

  if (!data.openid || !data.access_token) {
    throw new ApiError(
      data.errmsg ?? "服务号 OAuth 失败",
      ErrorCode.WECHAT_AUTH_FAILED,
      400,
    );
  }

  return {
    openid: data.openid,
    unionid: data.unionid,
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    scope: data.scope,
  };
}

export function resolveSafeRedirectPath(path: string | undefined): string {
  const fallback = "/";
  if (!path || !path.startsWith("/") || path.startsWith("//")) {
    return fallback;
  }
  const base = getPublicAppUrl();
  try {
    const resolved = new URL(path, base);
    if (resolved.origin !== new URL(base).origin) return fallback;
    return `${resolved.pathname}${resolved.search}${resolved.hash}`;
  } catch {
    return fallback;
  }
}

/** 微信服务器 URL 校验签名 */
export function verifyMpCallbackSignature(input: {
  token: string;
  timestamp: string;
  nonce: string;
  signature: string;
}): boolean {
  const { token, timestamp, nonce, signature } = input;
  const raw = [token, timestamp, nonce].sort().join("");
  const digest = createHash("sha1").update(raw).digest("hex");
  return digest === signature;
}

export function parseWechatXml(xml: string): Record<string, string> {
  const result: Record<string, string> = {};
  const re = /<(\w+)><!\[CDATA\[([\s\S]*?)]]><\/\1>|<(\w+)>([^<]*)<\/\3>/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(xml)) !== null) {
    const key = match[1] ?? match[3];
    const value = match[2] ?? match[4] ?? "";
    if (key) result[key] = value;
  }
  return result;
}

export function buildWechatTextReply(input: {
  toUser: string;
  fromUser: string;
  content: string;
}): string {
  const now = Math.floor(Date.now() / 1000);
  return (
    "<xml>" +
    `<ToUserName><![CDATA[${input.toUser}]]></ToUserName>` +
    `<FromUserName><![CDATA[${input.fromUser}]]></FromUserName>` +
    `<CreateTime>${now}</CreateTime>` +
    "<MsgType><![CDATA[text]]></MsgType>" +
    `<Content><![CDATA[${input.content}]]></Content>` +
    "</xml>"
  );
}
