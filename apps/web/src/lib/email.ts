import { render } from "@react-email/render";
import { sendMailViaMailgun, type MailgunSendResult } from "@/lib/mailgun";
import { InviteEmail } from "@/lib/email-templates/invite";
import { TransactionalEmail } from "@/lib/email-templates/transactional";
import type { BrandEmailEventInfo } from "@/lib/email-templates/brand-layout";

export type EmailSendResult = MailgunSendResult;

async function renderTransactionalHtml(input: {
  subject: string;
  body: string;
  heading?: string;
  greeting?: string;
  event?: BrandEmailEventInfo | null;
  ctaLabel?: string;
  ctaUrl?: string;
  footerNote?: string;
}) {
  const paragraphs = input.body
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  return render(
    TransactionalEmail({
      preview: input.subject,
      heading:
        input.heading ??
        (input.subject.replace(/^【[^】]+】/, "").trim() || "玖莅通知"),
      greeting: input.greeting,
      paragraphs:
        paragraphs.length > 0 ? paragraphs : ["请查收本邮件相关信息。"],
      event: input.event,
      ctaLabel: input.ctaLabel,
      ctaUrl: input.ctaUrl,
      footerNote: input.footerNote,
    }),
  );
}

async function sendEmail(
  to: string,
  subject: string,
  body: string,
  html?: string,
  extras?: {
    variables?: Record<string, string>;
    tags?: string[];
    event?: BrandEmailEventInfo | null;
    ctaLabel?: string;
    ctaUrl?: string;
    heading?: string;
  },
): Promise<EmailSendResult> {
  let resolvedHtml = html;
  if (!resolvedHtml) {
    try {
      resolvedHtml = await renderTransactionalHtml({
        subject,
        body,
        heading: extras?.heading,
        event: extras?.event,
        ctaLabel: extras?.ctaLabel,
        ctaUrl: extras?.ctaUrl,
      });
    } catch (error) {
      console.error("[EMAIL] Transactional HTML render failed:", error);
    }
  }

  const result = await sendMailViaMailgun({
    to,
    subject,
    text: body,
    html: resolvedHtml,
    variables: extras?.variables,
    tags: extras?.tags,
  });
  if (!result.sent) {
    console.error(`[EMAIL] Failed to=${to} subject=${subject}: ${result.error}`);
  } else if (result.dev) {
    console.warn(`[EMAIL] Dev-mode only (MAILGUN 未配置), to=${to} subject=${subject}`);
  }
  return result;
}

export async function sendApplicationConfirmationEmail(
  to: string,
  orgName: string,
) {
  const subject = "【玖莅】账号管理员申请已收到";
  const body = `您好，

我们已收到「${orgName}」的账号管理员申请，预计 1-3 个工作日内完成审核。

审核结果将通过短信和邮件通知您。

玖莅团队`;
  return sendEmail(to, subject, body, undefined, {
    heading: "申请已收到",
    tags: ["account-application"],
  });
}

export async function sendApplicationApprovedEmail(
  to: string,
  orgName: string,
) {
  const subject = "【玖莅】账号管理员审核已通过";
  const body = `您好，

恭喜！「${orgName}」的账号管理员申请已通过审核，组织主页已创建。

您现在可以登录玖莅管理后台开始使用。

玖莅团队`;
  return sendEmail(to, subject, body, undefined, {
    heading: "审核已通过",
    ctaLabel: "打开管理后台",
    ctaUrl: "https://9li.co/uc",
    tags: ["account-application"],
  });
}

export async function sendApplicationRejectedEmail(
  to: string,
  orgName: string,
  reason: string,
) {
  const subject = "【玖莅】账号管理员申请未通过";
  const body = `您好，

「${orgName}」的账号管理员申请未通过审核。

原因：${reason}

您可以修改申请信息后重新提交。

玖莅团队`;
  return sendEmail(to, subject, body, undefined, {
    heading: "申请未通过",
    tags: ["account-application"],
  });
}

export async function sendEventReviewNotificationEmail(
  to: string,
  eventName: string,
  message: string,
) {
  const subject = `【玖莅】活动审核通知：${eventName}`;
  const body = `您好，

关于活动「${eventName}」的审核结果：

${message}

玖莅团队`;
  return sendEmail(to, subject, body, undefined, {
    heading: "活动审核通知",
    event: {
      name: eventName,
      dateLabel: "详见活动后台",
      location: null,
    },
    tags: ["event-review"],
  });
}

export async function sendInviteEmail(params: {
  to: string;
  subject: string;
  participantName: string;
  eventName: string;
  eventDate: string;
  eventLocation: string;
  organizerName: string;
  activationLink: string;
  plainText: string;
  /** Mailgun 自定义变量，用于送达/打开/失败 Webhook 回写 */
  variables?: Record<string, string>;
}) {
  const body =
    params.plainText ||
    `您好 ${params.participantName}，

${params.organizerName} 邀请您参加「${params.eventName}」。

时间：${params.eventDate}
地点：${params.eventLocation}

请点击链接激活参会资格：
${params.activationLink}

玖莅团队`;

  let html: string | undefined;
  try {
    html = await render(
      InviteEmail({
        participantName: params.participantName,
        eventName: params.eventName,
        eventDate: params.eventDate,
        eventLocation: params.eventLocation,
        organizerName: params.organizerName,
        activationLink: params.activationLink,
      }),
    );
  } catch (error) {
    console.error("[EMAIL] InviteEmail HTML render failed, fallback plain:", error);
  }

  return sendEmail(params.to, params.subject, body, html, {
    variables: params.variables,
    tags: ["invite"],
  });
}

/** 运维/联调用：发送一封测试邮件 */
export async function sendTestEmail(to: string) {
  const subject = "【玖莅】Mailgun 联调测试";
  const body = `您好，

这是一封来自玖莅的 Mailgun 联调测试邮件。

若你收到此信，说明邮件发送通道已打通。

发送时间：${new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}

玖莅团队`;
  return sendEmail(to, subject, body, undefined, {
    heading: "通道联调测试",
    tags: ["ops-test"],
  });
}
