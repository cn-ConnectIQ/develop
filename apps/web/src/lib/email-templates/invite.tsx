import { Heading, Text } from "@react-email/components";
import { BrandEmailLayout } from "@/lib/email-templates/brand-layout";
import { EmailCtaButton } from "@/lib/email-templates/cta-button";

export type InviteEmailProps = {
  participantName: string;
  eventName: string;
  eventDate: string;
  eventLocation: string;
  organizerName: string;
  activationLink: string;
  unsubscribeLink?: string;
};

export function InviteEmail({
  participantName,
  eventName,
  eventDate,
  eventLocation,
  organizerName,
  activationLink,
  unsubscribeLink,
}: InviteEmailProps) {
  return (
    <BrandEmailLayout
      preview={`诚邀您参加 ${eventName}`}
      event={{
        name: eventName,
        dateLabel: eventDate,
        location: eventLocation,
        organizer: organizerName,
      }}
      footerNote={`${organizerName} · 由玖莅提供邀请服务`}
      unsubscribeLink={unsubscribeLink}
    >
      <Heading style={heading}>诚邀您参加本次活动</Heading>
      <Text style={greeting}>您好，{participantName}：</Text>
      <Text style={paragraph}>
        请点击下方按钮打开玖莅，完成入场激活。激活后即可使用现场互动、扫码连接与活动服务。
      </Text>
      <EmailCtaButton href={activationLink} label="打开玖莅，完成激活" />
      <Text style={linkFallback}>
        若按钮无法点击，请复制以下链接到浏览器打开：
      </Text>
      <Text style={linkBox}>{activationLink}</Text>
      <Text style={footnote}>此链接仅限您本人使用，请勿转发他人。</Text>
    </BrandEmailLayout>
  );
}

const heading = {
  color: "#1A2332",
  fontSize: "20px",
  fontWeight: "700" as const,
  lineHeight: "1.35",
  margin: "20px 0 12px",
};

const greeting = {
  color: "#4A5565",
  fontSize: "15px",
  lineHeight: "1.7",
  margin: "0 0 12px",
};

const paragraph = {
  color: "#4A5565",
  fontSize: "15px",
  lineHeight: "1.7",
  margin: "0 0 8px",
};

const linkFallback = {
  color: "#8A93A0",
  fontSize: "12px",
  lineHeight: "1.5",
  margin: "0 0 6px",
};

const linkBox = {
  color: "#5A6573",
  fontSize: "12px",
  lineHeight: "1.5",
  margin: "0 0 14px",
  padding: "10px 12px",
  backgroundColor: "#F5F7FA",
  borderRadius: "8px",
  border: "1px solid #E6EAF0",
  wordBreak: "break-all" as const,
};

const footnote = {
  color: "#8A93A0",
  fontSize: "12px",
  textAlign: "center" as const,
  margin: "8px 0 0",
};

export default InviteEmail;
