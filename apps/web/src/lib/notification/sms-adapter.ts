import { sendSmsContent } from "@/lib/sms";
import type { ChannelSendResult } from "@/lib/notification/types";

/** 唯一允许调用短信 SDK 的适配器 */
export async function smsAdapterSend(input: {
  phone: string;
  content: string;
  tag?: string;
  aliyunTemplateParam?: Record<string, string>;
  aliyunTemplateEnv?: string;
}): Promise<ChannelSendResult> {
  const result = await sendSmsContent({
    phone: input.phone,
    content: input.content,
    tag: input.tag,
    aliyunTemplateParam: input.aliyunTemplateParam,
    aliyunTemplateEnv: input.aliyunTemplateEnv,
  });
  return {
    success: result.success,
    messageId: result.messageId,
    error: result.error,
    provider: result.provider,
  };
}
