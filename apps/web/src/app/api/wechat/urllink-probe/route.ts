import { ErrorCode } from "@connectiq/types";
import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api-auth";
import { INVITE_ENTRY_MINI_PAGE } from "@/lib/invite/entry-service";
import {
  getWxMiniCredentials,
  getWxMiniProgramState,
} from "@/lib/wechat/config";
import { withWechatAccessToken } from "@/lib/wechat/access-token";

type WxApiResult = {
  url_link?: string;
  openlink?: string;
  errcode?: number;
  errmsg?: string;
};

/**
 * 探测 generate_urllink / generatescheme（不回传密钥）。
 * GET /api/wechat/urllink-probe
 */
export const GET = withErrorHandler(async () => {
  const creds = getWxMiniCredentials();
  if (!creds) {
    return createErrorResponse(
      "未配置 WX_MINI_APPID / WX_MINI_SECRET",
      ErrorCode.VALIDATION_ERROR,
      503,
    );
  }

  const programState = getWxMiniProgramState();
  const envVersions =
    programState === "formal"
      ? (["release", "trial", "develop"] as const)
      : programState === "trial"
        ? (["trial", "develop", "release"] as const)
        : (["develop", "trial", "release"] as const);

  const query = "t=probeUrlLinkTok12";
  const attempts: Array<Record<string, unknown>> = [];

  for (const env_version of envVersions) {
    let link: WxApiResult;
    try {
      link = await withWechatAccessToken(async (accessToken) => {
        const res = await fetch(
          `https://api.weixin.qq.com/wxa/generate_urllink?access_token=${accessToken}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              path: INVITE_ENTRY_MINI_PAGE,
              query,
              env_version,
              expire_type: 1,
              expire_interval: 1,
            }),
          },
        );
        return (await res.json()) as WxApiResult;
      });
    } catch (e) {
      link = {
        errcode: -1,
        errmsg: e instanceof Error ? e.message : String(e),
      };
    }

    attempts.push({ api: "generate_urllink", env_version, ...link });
    if (link.url_link) {
      return createSuccessResponse({
        ok: true,
        api: "generate_urllink",
        env_version,
        appIdPrefix: creds.appId.slice(0, 6),
        programState,
        url_link: link.url_link,
        attempts,
      });
    }
  }

  for (const env_version of envVersions) {
    let scheme: WxApiResult;
    try {
      scheme = await withWechatAccessToken(async (accessToken) => {
        const res = await fetch(
          `https://api.weixin.qq.com/wxa/generatescheme?access_token=${accessToken}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              jump_wxa: {
                path: INVITE_ENTRY_MINI_PAGE,
                query,
                env_version,
              },
              expire_type: 1,
              expire_interval: 1,
            }),
          },
        );
        return (await res.json()) as WxApiResult;
      });
    } catch (e) {
      scheme = {
        errcode: -1,
        errmsg: e instanceof Error ? e.message : String(e),
      };
    }

    attempts.push({ api: "generatescheme", env_version, ...scheme });
    if (scheme.openlink) {
      return createSuccessResponse({
        ok: true,
        api: "generatescheme",
        env_version,
        appIdPrefix: creds.appId.slice(0, 6),
        programState,
        openlink: scheme.openlink,
        attempts,
      });
    }
  }

  return createSuccessResponse({
    ok: false,
    appIdPrefix: creds.appId.slice(0, 6),
    programState,
    page: INVITE_ENTRY_MINI_PAGE,
    attempts,
  });
});
