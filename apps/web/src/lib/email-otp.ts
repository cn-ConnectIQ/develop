import { sendMailViaMailgun } from "@/lib/mailgun";

export const EMAIL_CODE_TTL = 300;
export const EMAIL_CODE_RATE_LIMIT = 60;

export function emailVerifyKey(email: string) {
  return `email:verify:${email.trim().toLowerCase()}`;
}

export function emailRateKey(email: string) {
  return `email:rate:${email.trim().toLowerCase()}`;
}

export function generateEmailCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function sendLoginEmailCode(email: string, code: string) {
  const subject = "玖莅 登录验证码";
  const text = `您的登录验证码是 ${code}，${EMAIL_CODE_TTL / 60} 分钟内有效。如非本人操作请忽略。`;
  const html = `<p>您的登录验证码是 <strong style="font-size:20px;letter-spacing:4px">${code}</strong></p><p>${EMAIL_CODE_TTL / 60} 分钟内有效。如非本人操作请忽略。</p>`;

  if (!process.env.MAILGUN_API_KEY?.trim()) {
    console.info(`[EMAIL DEV] ${email} 登录验证码: ${code}`);
    return { sent: true, dev: true as const };
  }

  const result = await sendMailViaMailgun({
    to: email,
    subject,
    text,
    html,
  });
  return {
    sent: result.sent,
    dev: Boolean(result.dev),
    error: result.error,
  };
}
