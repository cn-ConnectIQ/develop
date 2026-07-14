import { isAliyunSmsConfigured, sendAliyunSms } from "@/lib/aliyun-sms";
import {
  isSubmailConfigured,
  sendSubmailSms,
  sendSubmailXSend,
  type SmsSendResult,
} from "@/lib/submail-sms";

const SMS_CODE_TTL = 300;
const SMS_RATE_LIMIT = 60;

export type { SmsSendResult };

export function smsVerifyKey(phone: string) {
  return `sms:verify:${phone}`;
}

export function smsRateKey(phone: string) {
  return `sms:rate:${phone}`;
}

export function generateSmsCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/** auto：优先 Submail；aliyun / submail 强制指定 */
export function resolveSmsProvider(): "submail" | "aliyun" | "none" {
  const forced = process.env.SMS_PROVIDER?.trim().toLowerCase();
  if (forced === "submail") {
    return isSubmailConfigured() ? "submail" : "none";
  }
  if (forced === "aliyun") {
    return isAliyunSmsConfigured() ? "aliyun" : "none";
  }
  if (isSubmailConfigured()) return "submail";
  if (isAliyunSmsConfigured()) return "aliyun";
  return "none";
}

export function isSmsConfigured(): boolean {
  return resolveSmsProvider() !== "none";
}

/** 统一短信发送：正文模式（邀请/通知） */
export async function sendSmsContent(input: {
  phone: string;
  content: string;
  tag?: string;
  /** 阿里云回退时的模板变量 */
  aliyunTemplateParam?: Record<string, string>;
  aliyunTemplateEnv?: string;
}): Promise<SmsSendResult> {
  const provider = resolveSmsProvider();

  if (provider === "none") {
    console.info(`[SMS DEV] ${input.phone}: ${input.content}`);
    return {
      success: true,
      messageId: `dev-sms-${Date.now()}`,
      dev: true,
      provider: "dev",
    };
  }

  if (provider === "submail") {
    return sendSubmailSms({
      phone: input.phone,
      content: input.content,
      tag: input.tag,
    });
  }

  const result = await sendAliyunSms({
    phone: input.phone,
    templateEnv: input.aliyunTemplateEnv,
    templateParam: input.aliyunTemplateParam ?? {
      content: input.content.slice(0, 20),
    },
  });
  return { ...result, provider: "aliyun" };
}

export async function sendVerificationSms(phone: string, code: string) {
  const provider = resolveSmsProvider();
  if (provider === "none") {
    console.info(`[SMS DEV] ${phone} 验证码: ${code}`);
    return { sent: true, dev: true as const };
  }

  if (provider === "submail") {
    const project = process.env.SUBMAIL_PROJECT_CODE?.trim();
    const result = project
      ? await sendSubmailXSend({
          phone,
          project,
          vars: { code },
        })
      : await sendSubmailSms({
          phone,
          content: `您的验证码是${code}，${Math.round(SMS_CODE_TTL / 60)}分钟内有效。`,
        });
    if (!result.success) {
      console.error("[SMS] 验证码发送失败", result.error);
      return { sent: false, dev: false as const, error: result.error };
    }
    return { sent: true, dev: Boolean(result.dev) };
  }

  const result = await sendAliyunSms({
    phone,
    templateParam: { code },
  });
  if (!result.success) {
    console.error("[SMS] 验证码发送失败", result.error);
    return { sent: false, dev: false as const, error: result.error };
  }
  return { sent: true, dev: Boolean(result.dev) };
}

export async function sendNotificationSms(
  phone: string,
  message: string,
  templateParam?: Record<string, string>,
) {
  const result = await sendSmsContent({
    phone,
    content: message,
    aliyunTemplateParam: templateParam ?? { content: message.slice(0, 20) },
  });
  if (!result.success) {
    console.error("[SMS] 通知发送失败", result.error);
    return { sent: false, dev: Boolean(result.dev), error: result.error };
  }
  return { sent: true, dev: Boolean(result.dev) };
}

export { SMS_CODE_TTL, SMS_RATE_LIMIT };
