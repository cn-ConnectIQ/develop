import { OutboundChannel } from "@connectiq/database";
import { emailAdapterSend } from "@/lib/notification/email-adapter";
import { smsAdapterSend } from "@/lib/notification/sms-adapter";
import { wechatAdapterSend } from "@/lib/notification/wechat-adapter";
import type { ChannelSendResult } from "@/lib/notification/types";

export async function routeChannelSend(input: {
  channel: OutboundChannel;
  recipient: string;
  subject?: string | null;
  body: string;
  tag?: string;
  variables?: Record<string, string>;
  fromDisplayName?: string;
  replyTo?: string;
}): Promise<ChannelSendResult> {
  switch (input.channel) {
    case OutboundChannel.SMS:
      return smsAdapterSend({
        phone: input.recipient,
        content: input.body,
        tag: input.tag,
      });
    case OutboundChannel.EMAIL:
      return emailAdapterSend({
        to: input.recipient,
        subject: input.subject || "玖莅通知",
        text: input.body,
        variables: input.variables,
        fromDisplayName: input.fromDisplayName,
        replyTo: input.replyTo,
        tags: input.tag ? [input.tag] : undefined,
      });
    case OutboundChannel.WECHAT:
      return wechatAdapterSend({
        openId: input.recipient,
        templateId: "",
        data: {},
      });
    default:
      return { success: false, error: "未知渠道" };
  }
}
