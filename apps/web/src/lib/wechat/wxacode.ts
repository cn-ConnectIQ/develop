import { withWechatAccessToken } from "@/lib/wechat/access-token";
import {
  buildInviteEntryScene,
  INVITE_ENTRY_MINI_PAGE,
} from "@/lib/invite/entry-service";
import { getWxMiniProgramState } from "@/lib/wechat/config";

type WxacodeError = {
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
 * 获取不限制的小程序码（个人受邀入口）。
 * page = pages/activation/landing；scene = t_<token>（≤32）。
 * @see https://developers.weixin.qq.com/miniprogram/dev/OpenApiDoc/qrcode-link/qr-code/getUnlimitedQRCode.html
 */
export async function generateInviteEntryWxacode(options: {
  token: string;
  /** 默认 430 */
  width?: number;
  /** true 返回 base64 data URL；false 返回原始 Buffer */
  asDataUrl?: boolean;
}): Promise<{ scene: string; page: string; buffer: Buffer; dataUrl?: string }> {
  const scene = buildInviteEntryScene(options.token);
  const width = options.width ?? 430;

  const buffer = await withWechatAccessToken(async (accessToken) => {
    const res = await fetch(
      `https://api.weixin.qq.com/wxa/getwxacodeunlimit?access_token=${accessToken}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scene,
          page: INVITE_ENTRY_MINI_PAGE,
          check_path: false,
          env_version: toWxEnvVersion(),
          width,
        }),
      },
    );

    const contentType = res.headers.get("content-type") ?? "";
    const ab = await res.arrayBuffer();
    const buf = Buffer.from(ab);

    if (contentType.includes("application/json")) {
      const err = JSON.parse(buf.toString("utf8")) as WxacodeError;
      throw new Error(
        err.errmsg ?? `getwxacodeunlimit 失败 (${err.errcode ?? "unknown"})`,
      );
    }

    return buf;
  });

  return {
    scene,
    page: INVITE_ENTRY_MINI_PAGE,
    buffer,
    dataUrl: options.asDataUrl
      ? `data:image/png;base64,${buffer.toString("base64")}`
      : undefined,
  };
}
