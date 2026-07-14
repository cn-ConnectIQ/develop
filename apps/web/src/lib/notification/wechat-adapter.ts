import type { ChannelSendResult } from "@/lib/notification/types";

/** 微信订阅消息下一期；本期留空实现，保证路由可扩展 */
export async function wechatAdapterSend(_input: {
  openId: string;
  templateId: string;
  page?: string;
  data: Record<string, { value: string }>;
}): Promise<ChannelSendResult> {
  return {
    success: false,
    error: "微信订阅消息尚未开通",
    provider: "wechat_noop",
  };
}
