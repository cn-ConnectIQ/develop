import { ErrorCode } from "@connectiq/types";
import { ApiError } from "@/lib/api-auth";
import { getWxMiniCredentials } from "@/lib/wechat/config";

export type Code2SessionResult = {
  openid: string;
  session_key: string;
  unionid?: string;
};

type WechatCode2SessionResponse = {
  openid?: string;
  session_key?: string;
  unionid?: string;
  errcode?: number;
  errmsg?: string;
};

/** 微信 jscode2session 常见 errcode → 业务错误码 */
function mapWechatLoginError(errcode?: number, errmsg?: string): ApiError {
  switch (errcode) {
    case 40029:
      return new ApiError("微信登录码无效或已过期", ErrorCode.WECHAT_CODE_INVALID, 400);
    case 40163:
      return new ApiError("微信登录码已被使用", ErrorCode.WECHAT_CODE_USED, 400);
    case 45011:
      return new ApiError("微信登录请求过于频繁，请稍后再试", ErrorCode.WECHAT_AUTH_FAILED, 429);
    case 40013:
      return new ApiError("小程序 AppID 无效", ErrorCode.WECHAT_NOT_CONFIGURED, 500);
    case -1:
      return new ApiError("微信系统繁忙，请稍后再试", ErrorCode.WECHAT_AUTH_FAILED, 503);
    default:
      return new ApiError(
        errmsg ?? "微信登录失败",
        ErrorCode.WECHAT_AUTH_FAILED,
        400,
      );
  }
}

/**
 * 小程序 wx.login code → openid + session_key
 * @see https://developers.weixin.qq.com/miniprogram/dev/OpenApiDoc/user-login/code2Session.html
 */
export async function code2Session(jsCode: string): Promise<Code2SessionResult> {
  const creds = getWxMiniCredentials();

  if (!creds) {
    if (process.env.NODE_ENV === "development") {
      if (jsCode.startsWith("test_openid:")) {
        const openid = jsCode.slice("test_openid:".length);
        return { openid, session_key: "dev-session-key" };
      }
      return { openid: "dev-openid-default", session_key: "dev-session-key" };
    }
    throw new ApiError("微信登录未配置", ErrorCode.WECHAT_NOT_CONFIGURED, 500);
  }

  const url = new URL("https://api.weixin.qq.com/sns/jscode2session");
  url.searchParams.set("appid", creds.appId);
  url.searchParams.set("secret", creds.secret);
  url.searchParams.set("js_code", jsCode);
  url.searchParams.set("grant_type", "authorization_code");

  const res = await fetch(url.toString());
  const data = (await res.json()) as WechatCode2SessionResponse;

  if (!data.openid || !data.session_key) {
    throw mapWechatLoginError(data.errcode, data.errmsg);
  }

  return {
    openid: data.openid,
    session_key: data.session_key,
    unionid: data.unionid,
  };
}

/** 仅取 openid（登录 upsert 用） */
export async function code2OpenId(jsCode: string): Promise<string> {
  const { openid } = await code2Session(jsCode);
  return openid;
}
