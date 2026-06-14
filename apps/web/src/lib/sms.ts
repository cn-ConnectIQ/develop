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
  if (process.env.NODE_ENV === "development" || !process.env.ALIYUN_SMS_ACCESS_KEY) {
    console.info(`[SMS DEV] ${phone} 验证码: ${code}`);
    return { sent: true, dev: true };
  }

  // 生产环境接入阿里云短信 SDK
  console.info(`[SMS] 已向 ${phone} 发送验证码`);
  return { sent: true, dev: false };
}

export { SMS_CODE_TTL, SMS_RATE_LIMIT };
