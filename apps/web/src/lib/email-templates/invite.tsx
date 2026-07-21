import { Button, Heading, Section, Text } from "@react-email/components";
import { BrandEmailLayout } from "@/lib/email-templates/brand-layout";

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
      <Section style={buttonSection}>
        <Button style={button} href={activationLink}>
          打开玖莅，完成激活
        </Button>
      </Section>
      <Text style={linkFallback}>
        若按钮无法点击，请复制链接到浏览器打开：
        <br />
        {activationLink}
      </Text>
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

const buttonSection = {
  textAlign: "center" as const,
  margin: "24px 0 12px",
};

const button = {
  backgroundColor: "#0F6E56",
  borderRadius: "10px",
  color: "#ffffff",
  fontSize: "15px",
  fontWeight: "600" as const,
  textDecoration: "none",
  textAlign: "center" as const,
  display: "inline-block",
  padding: "12px 28px",
};

const linkFallback = {
  color: "#8A93A0",
  fontSize: "12px",
  lineHeight: "1.6",
  margin: "0 0 12px",
  wordBreak: "break-all" as const,
};

const footnote = {
  color: "#8A93A0",
  fontSize: "12px",
  textAlign: "center" as const,
  margin: "8px 0 0",
};

export default InviteEmail;
