import { cacheGet, cacheSet } from "@/lib/redis";
import { storeUploadBuffer } from "@/lib/storage/upload";
import { isQiniuConfigured } from "@/lib/storage/qiniu";
import {
  generateInviteEntryWxacode,
  generateInteractionSessionWxacode,
} from "@/lib/wechat/wxacode";
import { getWxMiniCredentials } from "@/lib/wechat/config";

const WXACODE_CACHE_TTL = 7 * 24 * 60 * 60;

function inviteCacheKey(token: string) {
  return `wxacode:invite:${token}`;
}

function interactionCacheKey(sessionCode: string) {
  return `wxacode:interaction:${sessionCode.toUpperCase()}`;
}

async function persistWxacodePng(input: {
  buffer: Buffer;
  key: string;
  dataUrlFallback: string;
}): Promise<string> {
  if (isQiniuConfigured()) {
    try {
      const stored = await storeUploadBuffer({
        buffer: input.buffer,
        contentType: "image/png",
        filename: "wxacode.png",
        key: input.key,
      });
      return stored.url;
    } catch (err) {
      console.warn("[wxacode] 七牛上传失败，降级 data URL:", err);
    }
  }
  return input.dataUrlFallback;
}

/** 邀请入口小程序码公开图 URL（CDN 或 data URL） */
export async function resolveInviteWxacodeImageUrl(
  token: string,
): Promise<string | null> {
  if (!getWxMiniCredentials()) return null;

  const cached = await cacheGet(inviteCacheKey(token));
  if (cached) return cached;

  try {
    const code = await generateInviteEntryWxacode({
      token,
      width: 280,
      asDataUrl: true,
    });
    const url = await persistWxacodePng({
      buffer: code.buffer,
      key: `qr/wxacode/invite/${token}.png`,
      dataUrlFallback: code.dataUrl!,
    });
    await cacheSet(inviteCacheKey(token), url, WXACODE_CACHE_TTL);
    return url;
  } catch (err) {
    console.warn("[wxacode] invite generate failed:", err);
    return null;
  }
}

/** 互动会话小程序码公开图 URL */
export async function resolveInteractionWxacodeImageUrl(
  sessionCode: string,
): Promise<string | null> {
  if (!getWxMiniCredentials()) return null;

  const normalized = sessionCode.trim().toUpperCase();
  const cached = await cacheGet(interactionCacheKey(normalized));
  if (cached) return cached;

  try {
    const code = await generateInteractionSessionWxacode({
      sessionCode: normalized,
      width: 280,
      asDataUrl: true,
    });
    const url = await persistWxacodePng({
      buffer: code.buffer,
      key: `qr/wxacode/interaction/${normalized}.png`,
      dataUrlFallback: code.dataUrl!,
    });
    await cacheSet(interactionCacheKey(normalized), url, WXACODE_CACHE_TTL);
    return url;
  } catch (err) {
    console.warn("[wxacode] interaction generate failed:", err);
    return null;
  }
}
