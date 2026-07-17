import { cacheGet, cacheSet } from "@/lib/redis";
import {
  createOrReuseInviteEntry,
  buildInviteEntryMiniPath,
  INVITE_ENTRY_MINI_PAGE,
} from "@/lib/invite/entry-service";
import {
  getWxMiniCredentials,
  getWxMiniProgramState,
} from "@/lib/wechat/config";
import { withWechatAccessToken } from "@/lib/wechat/access-token";

const URL_LINK_CACHE_TTL_SECONDS = 25 * 24 * 60 * 60; // 略短于微信最长 30 天
const URL_LINK_EXPIRE_DAYS = 30;

type UrlLinkResponse = {
  url_link?: string;
  errcode?: number;
  errmsg?: string;
};

function cacheKey(entryToken: string) {
  return `invite:mp_url_link:${entryToken}`;
}

function preferredEnvVersions(): Array<"release" | "trial" | "develop"> {
  const state = getWxMiniProgramState();
  if (state === "formal") return ["release", "trial", "develop"];
  if (state === "trial") return ["trial", "develop", "release"];
  return ["develop", "trial", "release"];
}

async function generateUrlLinkRaw(
  entryToken: string,
  envVersion: "release" | "trial" | "develop",
): Promise<string> {
  const query = `t=${encodeURIComponent(entryToken)}`;
  return withWechatAccessToken(async (accessToken) => {
    const res = await fetch(
      `https://api.weixin.qq.com/wxa/generate_urllink?access_token=${accessToken}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: INVITE_ENTRY_MINI_PAGE,
          query,
          env_version: envVersion,
          expire_type: 1,
          expire_interval: URL_LINK_EXPIRE_DAYS,
        }),
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
}

/**
 * 为邀请参会者准备小程序入口：
 * - 短信/邮件仍发 https://9li.co/a/{activationToken}
 * - 打开短链时再生成微信 URL Link（MarketUP 同思路）
 */
export async function prepareInviteMiniLaunch(input: {
  eventId: string;
  participantId: string;
  phone?: string | null;
  name?: string | null;
  createdBy?: string | null;
}): Promise<{
  entryToken: string;
  miniPath: string;
  mpUrlLink: string | null;
  error?: string;
}> {
  let entry;
  try {
    entry = await createOrReuseInviteEntry({
      eventId: input.eventId,
      participantId: input.participantId,
      phone: input.phone,
      name: input.name,
      createdBy: input.createdBy,
    });
  } catch {
    // 手机号格式异常时退回活动通用入口，仍尽量生成 URL Link
    entry = await createOrReuseInviteEntry({
      eventId: input.eventId,
      participantId: input.participantId,
      phone: null,
      name: input.name,
      createdBy: input.createdBy,
    });
  }

  const miniPath = buildInviteEntryMiniPath(entry.token);

  if (!getWxMiniCredentials()) {
    return {
      entryToken: entry.token,
      miniPath,
      mpUrlLink: null,
      error: "未配置 WX_MINI_APPID / WX_MINI_SECRET",
    };
  }

  const cached = await cacheGet(cacheKey(entry.token));
  if (cached?.startsWith("http")) {
    return {
      entryToken: entry.token,
      miniPath,
      mpUrlLink: cached,
    };
  }

  let lastError = "generate_urllink 失败";
  for (const envVersion of preferredEnvVersions()) {
    try {
      const urlLink = await generateUrlLinkRaw(entry.token, envVersion);
      await cacheSet(cacheKey(entry.token), urlLink, URL_LINK_CACHE_TTL_SECONDS);
      return {
        entryToken: entry.token,
        miniPath,
        mpUrlLink: urlLink,
      };
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
      continue;
    }
  }

  return {
    entryToken: entry.token,
    miniPath,
    mpUrlLink: null,
    error: lastError,
  };
}
