import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";

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
  unsubscribeLink = "https://app.connectiq.cn/unsubscribe",
}: InviteEmailProps) {
  return (
    <Html lang="zh-CN">
      <Head />
      <Preview>您已受邀参加 {eventName}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Text style={logo}>ConnectIQ</Text>

          <Heading style={heading}>您已受邀参加 {eventName}</Heading>

          <Text style={greeting}>您好，{participantName}：</Text>

          <Section style={infoBox}>
            <Text style={infoLine}>📅 {eventDate}</Text>
            <Text style={infoLine}>📍 {eventLocation || "地点待定"}</Text>
          </Section>

          <Text style={paragraph}>
            在现场结识更多人，让每次相遇都有价值。
          </Text>

          <Section style={buttonSection}>
            <Button style={button} href={activationLink}>
              立即加入 ConnectIQ →
            </Button>
          </Section>

          <Text style={footnote}>
            此链接 7 天内有效，仅限您本人使用。
          </Text>

          <Hr style={hr} />

          <Text style={footer}>
            {organizerName} · 由 ConnectIQ 提供邀请服务
          </Text>
          <Link href={unsubscribeLink} style={unsubscribe}>
            退订此类邮件
          </Link>
        </Container>
      </Body>
    </Html>
  );
}

const main = {
  backgroundColor: "#f6f6f4",
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
};

const container = {
  backgroundColor: "#ffffff",
  margin: "40px auto",
  padding: "32px 28px",
  borderRadius: "12px",
  maxWidth: "560px",
};

const logo = {
  color: "#185FA5",
  fontSize: "20px",
  fontWeight: "700" as const,
  margin: "0 0 24px",
};

const heading = {
  color: "#1a1a1a",
  fontSize: "22px",
  fontWeight: "600" as const,
  lineHeight: "1.4",
  margin: "0 0 16px",
};

const greeting = {
  color: "#4a4a4a",
  fontSize: "15px",
  lineHeight: "1.6",
  margin: "0 0 16px",
};

const infoBox = {
  backgroundColor: "#f0f6fc",
  borderRadius: "8px",
  padding: "12px 16px",
  margin: "0 0 20px",
};

const infoLine = {
  color: "#185FA5",
  fontSize: "14px",
  margin: "4px 0",
};

const paragraph = {
  color: "#4a4a4a",
  fontSize: "15px",
  lineHeight: "1.6",
  margin: "0 0 24px",
};

const buttonSection = {
  textAlign: "center" as const,
  margin: "0 0 16px",
};

const button = {
  backgroundColor: "#185FA5",
  borderRadius: "8px",
  color: "#ffffff",
  fontSize: "16px",
  fontWeight: "600" as const,
  textDecoration: "none",
  textAlign: "center" as const,
  display: "inline-block",
  padding: "12px 28px",
};

const footnote = {
  color: "#888888",
  fontSize: "12px",
  textAlign: "center" as const,
  margin: "0 0 24px",
};

const hr = {
  borderColor: "#e8e8e4",
  margin: "24px 0",
};

const footer = {
  color: "#888888",
  fontSize: "12px",
  textAlign: "center" as const,
  margin: "0 0 8px",
};

const unsubscribe = {
  color: "#888888",
  fontSize: "11px",
  display: "block",
  textAlign: "center" as const,
};

export default InviteEmail;
