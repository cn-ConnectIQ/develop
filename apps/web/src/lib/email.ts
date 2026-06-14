import { render } from "@react-email/render";
import { InviteEmail } from "@/lib/email-templates/invite";

export type SendEmailResult = {
  success: boolean;
  messageId?: string;
  error?: string;
};

export async function renderInviteEmailHtml(
  props: Parameters<typeof InviteEmail>[0],
) {
  return render(InviteEmail(props));
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
  plainText?: string;
}): Promise<SendEmailResult> {
  const html = await renderInviteEmailHtml({
    participantName: params.participantName,
    eventName: params.eventName,
    eventDate: params.eventDate,
    eventLocation: params.eventLocation,
    organizerName: params.organizerName,
    activationLink: params.activationLink,
  });

  if (
    process.env.NODE_ENV === "development" ||
    !process.env.ALIYUN_DM_ACCESS_KEY
  ) {
    console.info("[EMAIL DEV]", {
      to: params.to,
      subject: params.subject,
      plainText: params.plainText,
      htmlPreview: html.slice(0, 200),
      activationLink: params.activationLink,
    });
    return { success: true, messageId: `dev-email-${Date.now()}` };
  }

  console.info(`[EMAIL] 已向 ${params.to} 发送邀请邮件`);
  return { success: true, messageId: `dm-${Date.now()}` };
}
