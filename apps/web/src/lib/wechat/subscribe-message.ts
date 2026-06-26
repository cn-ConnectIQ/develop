import { prisma } from "@connectiq/database";
import {
  getSubscribeTemplateId,
  getWxMiniProgramState,
} from "@/lib/wechat/config";
import { withWechatAccessToken } from "@/lib/wechat/access-token";

export type SubscribeMessageScene =
  | "EXCHANGE_REQUEST"
  | "EXCHANGE_RESULT"
  | "MEETING_INVITE"
  | "EXHIBITOR_INVITE"
  | "LOTTERY_RESULT";

export type SendSubscribeMessageResult = {
  success: boolean;
  msgid?: string;
  skipped?: boolean;
  reason?: string;
  error?: string;
};

export type SendSubscribeMessageInput = {
  /** 接收者 openid */
  touser: string;
  scene: SubscribeMessageScene;
  page?: string;
  data?: Record<string, { value: string }>;
};

const TEMPLATE_ENV_KEYS: Record<SubscribeMessageScene, [string, string?]> = {
  EXCHANGE_REQUEST: ["WX_TMPL_EXCHANGE_REQUEST"],
  EXCHANGE_RESULT: ["WX_TMPL_EXCHANGE_RESULT"],
  MEETING_INVITE: ["WX_TMPL_MEETING_INVITE"],
  EXHIBITOR_INVITE: ["WX_TMPL_EXHIBITOR_INVITE"],
  LOTTERY_RESULT: ["WX_TMPL_LOTTERY_RESULT"],
};

const DEFAULT_PAGES: Record<SubscribeMessageScene, string> = {
  EXCHANGE_REQUEST: "pages/notifications/index",
  EXCHANGE_RESULT: "pages/notifications/index",
  MEETING_INVITE: "pages/meetings/index",
  EXHIBITOR_INVITE: "pages/event/home",
  LOTTERY_RESULT: "pages/lottery/result",
};

type WechatSubscribeResponse = {
  errcode?: number;
  errmsg?: string;
  msgid?: number;
};

function truncate(value: string, max: number): string {
  const chars = [...value];
  if (chars.length <= max) return value;
  return chars.slice(0, max - 1).join("") + "…";
}

/** 发送小程序订阅消息 */
export async function sendSubscribeMessage(
  input: SendSubscribeMessageInput,
): Promise<SendSubscribeMessageResult> {
  const templateId = getSubscribeTemplateId(...TEMPLATE_ENV_KEYS[input.scene]);
  if (!templateId) {
    if (process.env.NODE_ENV === "development") {
      console.info("[WECHAT SUBSCRIBE DEV]", input);
      return { success: true, msgid: `dev-${Date.now()}`, skipped: true, reason: "no_template" };
    }
    return {
      success: false,
      skipped: true,
      reason: "template_not_configured",
    };
  }

  if (!input.touser) {
    return { success: false, skipped: true, reason: "missing_openid" };
  }

  if (process.env.NODE_ENV === "development" && input.touser.startsWith("dev-")) {
    console.info("[WECHAT SUBSCRIBE DEV]", { ...input, templateId });
    return { success: true, msgid: `dev-${Date.now()}` };
  }

  const body = {
    touser: input.touser,
    template_id: templateId,
    page: input.page ?? DEFAULT_PAGES[input.scene],
    miniprogram_state: getWxMiniProgramState(),
    lang: "zh_CN",
    data: input.data ?? {},
  };

  try {
    const result = await withWechatAccessToken(async (accessToken) => {
      const res = await fetch(
        `https://api.weixin.qq.com/cgi-bin/message/subscribe/send?access_token=${accessToken}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const json = (await res.json()) as WechatSubscribeResponse;
      if (json.errcode && json.errcode !== 0) {
        throw new Error(`errcode=${json.errcode} ${json.errmsg ?? ""}`.trim());
      }
      return json;
    });

    return {
      success: true,
      msgid: result.msgid != null ? String(result.msgid) : undefined,
    };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error("[WECHAT SUBSCRIBE]", input.scene, error);
    return { success: false, error };
  }
}

export async function getUserWechatOpenId(userId: string): Promise<string | null> {
  const identity = await prisma.userIdentity.findFirst({
    where: { userId, provider: "wechat_mini" },
    select: { value: true },
  });
  return identity?.value ?? null;
}

async function sendToUser(
  userId: string,
  scene: SubscribeMessageScene,
  data: Record<string, { value: string }>,
  page?: string,
): Promise<SendSubscribeMessageResult> {
  const openid = await getUserWechatOpenId(userId);
  if (!openid) {
    return { success: false, skipped: true, reason: "user_no_openid" };
  }
  return sendSubscribeMessage({ touser: openid, scene, data, page });
}

/** A 请求交换 → 推送给 B */
export async function sendExchangeRequestSubscribe(input: {
  toUserId: string;
  fromName: string;
  eventName?: string;
  requestId?: string;
}) {
  return sendToUser(
    input.toUserId,
    "EXCHANGE_REQUEST",
    {
      thing1: { value: truncate(input.fromName, 20) },
      thing2: { value: truncate(input.eventName ?? "活动现场", 20) },
      thing3: { value: "想与你交换微信" },
    },
    input.requestId
      ? `pages/exchange/confirm?requestId=${input.requestId}`
      : undefined,
  );
}

/** B 同意交换 → 推送给 A */
export async function sendExchangeResultSubscribe(input: {
  toUserId: string;
  accepterName: string;
  eventName?: string;
  requestId?: string;
}) {
  return sendToUser(
    input.toUserId,
    "EXCHANGE_RESULT",
    {
      thing1: { value: truncate(input.accepterName, 20) },
      thing2: { value: "已同意交换微信" },
      thing3: { value: truncate(input.eventName ?? "活动现场", 20) },
    },
    input.requestId
      ? `pages/exchange/success?requestId=${input.requestId}`
      : undefined,
  );
}

/** 会面邀请（MT3） */
export async function sendMeetingInviteSubscribe(input: {
  toUserId: string;
  requesterName: string;
  eventName: string;
  scheduledAt?: Date | string | null;
  meetingId?: string;
}) {
  const timeLabel = input.scheduledAt
    ? new Date(input.scheduledAt).toLocaleString("zh-CN", {
        month: "numeric",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "待确认时间";

  return sendToUser(
    input.toUserId,
    "MEETING_INVITE",
    {
      thing1: { value: truncate(input.requesterName, 20) },
      time2: { value: timeLabel },
      thing3: { value: truncate(input.eventName, 20) },
    },
    input.meetingId ? `pages/meetings/detail?id=${input.meetingId}` : undefined,
  );
}

/** 展商邀请 */
export async function sendExhibitorInviteSubscribe(input: {
  toUserId: string;
  exhibitorName: string;
  eventName: string;
  boothId?: string;
}) {
  return sendToUser(
    input.toUserId,
    "EXHIBITOR_INVITE",
    {
      thing1: { value: truncate(input.exhibitorName, 20) },
      thing2: { value: truncate(input.eventName, 20) },
      thing3: { value: "邀请您到展位交流" },
    },
    input.boothId ? `pages/booth/detail?id=${input.boothId}` : undefined,
  );
}

/** 开奖 / 中奖通知 */
export async function sendLotteryResultSubscribe(input: {
  toUserId: string;
  lotteryTitle: string;
  prizeName: string;
  lotteryId?: string;
}) {
  return sendToUser(
    input.toUserId,
    "LOTTERY_RESULT",
    {
      thing1: { value: truncate(input.lotteryTitle, 20) },
      thing2: { value: truncate(input.prizeName, 20) },
      thing3: { value: "恭喜中奖" },
    },
    input.lotteryId ? `pages/lottery/result?id=${input.lotteryId}` : undefined,
  );
}
