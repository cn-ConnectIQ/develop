import { withWechatAccessToken } from "@/lib/wechat/access-token";
import {
  buildInviteEntryMiniPath,
  INVITE_ENTRY_MINI_PAGE,
} from "@/lib/invite/entry-service";
import { getWxMiniProgramState } from "@/lib/wechat/config";

type UrlLinkResponse = {
  url_link?: string;
  errcode?: number;
  errmsg?: string;
};

function toWxEnvVersion(): "release" | "trial" | "develop" {
  const state = getWxMiniProgramState();
  if (state === "formal") return "release";
  if (state === "trial") return "trial";
  return "develop";
}

/**
 * 微信获取加密 URL Link（短信 / 邮件短链用）。
 * path 仅携带 `t=<token>`，不放 eventId / phone。
 * @see https://developers.weixin.qq.com/miniprogram/dev/OpenApiDoc/qrcode-link/url-link/generateUrlLink.html
 */
export async function generateInviteEntryUrlLink(options: {
  token: string;
  /** 有效天数 1–30；不传则按微信默认 */
  expireDays?: number;
}): Promise<{ urlLink: string; path: string }> {
  const path = buildInviteEntryMiniPath(options.token);
  const query = `t=${encodeURIComponent(options.token)}`;

  const urlLink = await withWechatAccessToken(async (accessToken) => {
    const body: Record<string, unknown> = {
      path: INVITE_ENTRY_MINI_PAGE,
      query,
      env_version: toWxEnvVersion(),
    };

    if (options.expireDays && options.expireDays > 0) {
      body.expire_type = 1;
      body.expire_interval = Math.min(
        Math.max(Math.floor(options.expireDays), 1),
        30,
      );
    }

    const res = await fetch(
      `https://api.weixin.qq.com/wxa/generate_urllink?access_token=${accessToken}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );
    const data = (await res.json()) as UrlLinkResponse;
    if (!data.url_link || (data.errcode && data.errcode !== 0)) {
      throw new Error(
        data.errmsg ?? `generate_urllink 失败 (${data.errcode ?? "unknown"})`,
      );
    }
    return data.url_link;
  });

  return { urlLink, path };
}
