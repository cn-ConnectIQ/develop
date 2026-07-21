import { render } from "@react-email/render";
import { sendMailViaMailgun } from "@/lib/mailgun";
import { TransactionalEmail } from "@/lib/email-templates/transactional";

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
  const subject = "【玖莅】登录验证码";
  const text = `您的登录验证码是 ${code}，${EMAIL_CODE_TTL / 60} 分钟内有效。如非本人操作请忽略。`;

  let html: string | undefined;
  try {
    html = await render(
      TransactionalEmail({
        preview: subject,
        heading: "登录验证码",
        paragraphs: [
          `您的登录验证码是 ${code}。`,
          `${EMAIL_CODE_TTL / 60} 分钟内有效，请勿泄露给他人。`,
          "如非本人操作，请忽略本邮件。",
        ],
        footnote: `验证码：${code}`,
      }),
    );
  } catch (error) {
    console.error("[EMAIL] OTP template render failed:", error);
    html = `<p>您的登录验证码是 <strong style="font-size:20px;letter-spacing:4px">${code}</strong></p><p>${EMAIL_CODE_TTL / 60} 分钟内有效。如非本人操作请忽略。</p>`;
  }

  const hasMailgunKey = Boolean(process.env.MAILGUN_API_KEY?.trim());
  const isProd = process.env.NODE_ENV === "production";

  if (!hasMailgunKey) {
    if (isProd) {
      return {
        sent: false,
        dev: false as const,
        error: "邮件服务未配置（缺少 MAILGUN_API_KEY）",
      };
    }
    console.info(`[EMAIL DEV] ${email} 登录验证码: ${code}`);
    return { sent: true, dev: true as const };
  }

  const result = await sendMailViaMailgun({
    to: email,
    subject,
    text,
    html,
    tags: ["auth-otp"],
  });

  if (result.dev && isProd) {
    return {
      sent: false,
      dev: false as const,
      error: "邮件服务未完整配置（MAILGUN_DOMAIN）",
    };
  }

  return {
    sent: result.sent,
    dev: Boolean(result.dev),
    error: result.error,
  };
}
