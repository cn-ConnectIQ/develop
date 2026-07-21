import { render } from "@react-email/render";
import {
  plainTextToHtml,
  sendMailViaMailgun,
} from "@/lib/mailgun";
import { TransactionalEmail } from "@/lib/email-templates/transactional";
import type { ChannelSendResult } from "@/lib/notification/types";

function markdownishToHtml(text: string): string {
  const withLinks = text.replace(
    /\*\*\[\s*([^\]]+)\s*→?\s*\]\(([^)]+)\)\*\*/g,
    (_m, label, href) =>
      `<p style="margin:24px 0"><a href="${href}" style="display:inline-block;padding:12px 20px;background:#0F6E56;color:#fff;text-decoration:none;border-radius:8px">${label}</a></p>`,
  );
  const bold = withLinks.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  return plainTextToHtml(bold);
}

function extractCta(text: string): { body: string; ctaUrl?: string; ctaLabel?: string } {
  const md = text.match(/\*\*\[\s*([^\]]+)\s*→?\s*\]\(([^)]+)\)\*\*/);
  if (md) {
    return {
      body: text.replace(md[0], "").trim(),
      ctaLabel: md[1]?.trim() || "查看详情",
      ctaUrl: md[2]?.trim(),
    };
  }
  const url = text.match(/https?:\/\/\S+/);
  if (url) {
    return {
      body: text.replace(url[0], "").trim(),
      ctaLabel: "打开链接",
      ctaUrl: url[0],
    };
  }
  return { body: text };
}

/** 唯一允许调用邮件 SDK 的适配器 */
export async function emailAdapterSend(input: {
  to: string;
  subject: string;
  text: string;
  html?: string;
  fromDisplayName?: string;
  replyTo?: string;
  variables?: Record<string, string>;
  tags?: string[];
}): Promise<ChannelSendResult> {
  let html = input.html;
  if (!html) {
    try {
      const vars = input.variables ?? {};
      const eventName = vars.event_name || vars.eventName;
      const extracted = extractCta(input.text);
      const paragraphs = extracted.body
        .split(/\n+/)
        .map((l) => l.trim())
        .filter(Boolean);
      html = await render(
        TransactionalEmail({
          preview: input.subject,
          heading:
            input.subject.replace(/^【[^】]+】\s*/, "").trim() || "玖莅通知",
          paragraphs:
            paragraphs.length > 0 ? paragraphs : ["请查收本邮件相关信息。"],
          ctaLabel: extracted.ctaLabel,
          ctaUrl: extracted.ctaUrl || vars.activation_link,
          event: eventName
            ? {
                name: eventName,
                dateLabel: vars.event_date || vars.eventDate || "详见活动安排",
                location: vars.event_location || vars.eventLocation || null,
                organizer: vars.organizer_name || vars.organizer || null,
              }
            : null,
        }),
      );
    } catch (error) {
      console.error("[EMAIL] Brand template render failed, fallback:", error);
      html = markdownishToHtml(input.text);
    }
  }

  const result = await sendMailViaMailgun({
    to: input.to,
    subject: input.subject,
    text: input.text,
    html,
    variables: input.variables,
    tags: input.tags,
  });
  return {
    success: result.sent,
    messageId: result.messageId,
    error: result.error,
    provider: result.dev ? "dev" : "mailgun",
  };
}
