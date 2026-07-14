import {
  isAliyunSmsConfigured,
  sendAliyunSms,
} from "@/lib/aliyun-sms";

const SMS_CODE_TTL = 300;
const SMS_RATE_LIMIT = 60;

export function smsVerifyKey(phone: string) {
  return `sms:verify:${phone}`;
}

export function smsRateKey(phone: string) {
  return `sms:rate:${phone}`;
}

export function generateSmsCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function sendVerificationSms(phone: string, code: string) {
  if (!isAliyunSmsConfigured()) {
    console.info(`[SMS DEV] ${phone} 验证码: ${code}`);
    return { sent: true, dev: true as const };
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
  if (!isAliyunSmsConfigured()) {
    console.info(`[SMS DEV] ${phone} 通知: ${message}`);
    return { sent: true, dev: true as const };
  }

  const result = await sendAliyunSms({
    phone,
    templateParam: templateParam ?? { content: message.slice(0, 20) },
  });
  if (!result.success) {
    console.error("[SMS] 通知发送失败", result.error);
    return { sent: false, dev: false as const, error: result.error };
  }
  return { sent: true, dev: Boolean(result.dev) };
}

export { SMS_CODE_TTL, SMS_RATE_LIMIT };
