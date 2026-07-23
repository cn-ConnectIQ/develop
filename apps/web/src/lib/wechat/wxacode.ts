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

/** 互动会话小程序 scene：`i_` + sessionCode（6 位 → 总长 8 ≤ 32） */
export const INTERACTION_SCENE_PREFIX = "i_";

/**
 * 互动扫码落地：走小程序首页，由小程序 onLaunch/onShow 解析 scene。
 * page 为空 = 主页（无需额外发布页面即可出码）。
 */
export const INTERACTION_JOIN_MINI_PAGE = "";

function toWxEnvVersion(): "release" | "trial" | "develop" {
  const state = getWxMiniProgramState();
  if (state === "formal") return "release";
  if (state === "trial") return "trial";
  return "develop";
}

export function buildInteractionSessionScene(sessionCode: string): string {
  const code = sessionCode.trim().toUpperCase();
  const scene = `${INTERACTION_SCENE_PREFIX}${code}`;
  if (scene.length > 32) {
    throw new Error(`互动 scene 超长（${scene.length} > 32）`);
  }
  return scene;
}

/**
 * 通用 getwxacodeunlimit。
 * @see https://developers.weixin.qq.com/miniprogram/dev/OpenApiDoc/qrcode-link/qr-code/getUnlimitedQRCode.html
 */
export async function generateUnlimitedWxacode(options: {
  scene: string;
  /** 空字符串 = 小程序主页 */
  page?: string;
  width?: number;
  asDataUrl?: boolean;
}): Promise<{ scene: string; page: string; buffer: Buffer; dataUrl?: string }> {
  if (options.scene.length > 32) {
    throw new Error(`scene 超长（${options.scene.length} > 32）`);
  }
  const page = options.page ?? "";
  const width = options.width ?? 430;

  const buffer = await withWechatAccessToken(async (accessToken) => {
    const body: Record<string, unknown> = {
      scene: options.scene,
      check_path: false,
      env_version: toWxEnvVersion(),
      width,
    };
    // 微信：不传 page 或空串均跳转主页
    if (page) body.page = page;

    const res = await fetch(
      `https://api.weixin.qq.com/wxa/getwxacodeunlimit?access_token=${accessToken}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
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
    scene: options.scene,
    page,
    buffer,
    dataUrl: options.asDataUrl
      ? `data:image/png;base64,${buffer.toString("base64")}`
      : undefined,
  };
}

/**
 * 受邀入口小程序码。
 * page = pages/activation/landing；scene = t_<token>（≤32）。
 */
export async function generateInviteEntryWxacode(options: {
  token: string;
  width?: number;
  asDataUrl?: boolean;
}): Promise<{ scene: string; page: string; buffer: Buffer; dataUrl?: string }> {
  return generateUnlimitedWxacode({
    scene: buildInviteEntryScene(options.token),
    page: INVITE_ENTRY_MINI_PAGE,
    width: options.width,
    asDataUrl: options.asDataUrl,
  });
}

/**
 * 互动会话小程序码（投票/抽奖大屏扫码参与）。
 * scene = i_<sessionCode>；落地小程序主页由 scene 分流。
 */
export async function generateInteractionSessionWxacode(options: {
  sessionCode: string;
  width?: number;
  asDataUrl?: boolean;
}): Promise<{ scene: string; page: string; buffer: Buffer; dataUrl?: string }> {
  return generateUnlimitedWxacode({
    scene: buildInteractionSessionScene(options.sessionCode),
    page: INTERACTION_JOIN_MINI_PAGE,
    width: options.width,
    asDataUrl: options.asDataUrl,
  });
}
