import {
  plainTextToHtml,
  sendMailViaMailgun,
} from "@/lib/mailgun";
import type { ChannelSendResult } from "@/lib/notification/types";

function markdownishToHtml(text: string): string {
  const withLinks = text.replace(
    /\*\*\[\s*([^\]]+)\s*→?\s*\]\(([^)]+)\)\*\*/g,
    (_m, label, href) =>
      `<p style="margin:24px 0"><a href="${href}" style="display:inline-block;padding:12px 20px;background:#111;color:#fff;text-decoration:none;border-radius:6px">${label}</a></p>`,
  );
  const bold = withLinks.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  return plainTextToHtml(bold);
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
  const result = await sendMailViaMailgun({
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html ?? markdownishToHtml(input.text),
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
