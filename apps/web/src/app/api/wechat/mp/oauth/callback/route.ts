import { NextRequest, NextResponse } from "next/server";
import { getPublicAppUrl } from "@/lib/wechat/config";
import {
  exchangeMpOAuthCode,
  parseMpOAuthState,
  resolveSafeRedirectPath,
} from "@/lib/wechat/mp-oauth";
import { completeMpOAuthLogin } from "@/lib/wechat/mp-service";

const AUTH_COOKIE = "connectiq_mini_token";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

/** 服务号 OAuth 回调：绑定 openid/unionid 并写入登录 cookie */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const stateRaw = request.nextUrl.searchParams.get("state") ?? "";

  if (!code) {
    return NextResponse.redirect(
      new URL("/?wx_error=missing_code", getPublicAppUrl()),
    );
  }

  try {
    const oauth = await exchangeMpOAuthCode(code);
    const { token } = await completeMpOAuthLogin(oauth);
    const state = parseMpOAuthState(stateRaw);
    const redirectPath = resolveSafeRedirectPath(state.redirect);
    const redirectUrl = new URL(redirectPath, getPublicAppUrl());
    redirectUrl.searchParams.set("wx_auth", "1");

    const response = NextResponse.redirect(redirectUrl);
    response.cookies.set(AUTH_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: COOKIE_MAX_AGE,
    });
    return response;
  } catch {
    return NextResponse.redirect(
      new URL("/?wx_error=oauth_failed", getPublicAppUrl()),
    );
  }
}
