import { NextRequest, NextResponse } from "next/server";
import { buildMpOAuthUrl } from "@/lib/wechat/mp-oauth";

/** 发起服务号网页授权（微信内 H5 打开） */
export async function GET(request: NextRequest) {
  const redirect = request.nextUrl.searchParams.get("redirect") ?? "/";
  const eventId = request.nextUrl.searchParams.get("eventId") ?? undefined;
  const scope =
    request.nextUrl.searchParams.get("scope") === "userinfo"
      ? "snsapi_userinfo"
      : "snsapi_base";

  const url = buildMpOAuthUrl({
    redirectPath: redirect,
    eventId,
    scope,
  });

  return NextResponse.redirect(url);
}
