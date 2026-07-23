import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import type { ReactNode } from "react";

export type BrandEmailEventInfo = {
  name: string;
  dateLabel: string;
  location?: string | null;
  organizer?: string | null;
};

type BrandEmailLayoutProps = {
  preview: string;
  children: ReactNode;
  event?: BrandEmailEventInfo | null;
  footerNote?: string;
  unsubscribeLink?: string;
};

const SITE = "https://9li.co/uc";

export function BrandEmailLayout({
  preview,
  children,
  event,
  footerNote,
  unsubscribeLink,
}: BrandEmailLayoutProps) {
  return (
    <Html lang="zh-CN">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={header}>
            <Text style={logoText}>玖莅 9li.co</Text>
            <Text style={logoSub}>让每次相遇都有价值</Text>
          </Section>

          {event ? (
            <Section style={eventCard}>
              <Text style={eventName}>{event.name}</Text>
              <Text style={eventMeta}>时间　{event.dateLabel || "日期待定"}</Text>
              <Text style={eventMeta}>
                地点　{event.location?.trim() || "地点待定"}
              </Text>
              {event.organizer?.trim() ? (
                <Text style={eventMeta}>主办　{event.organizer.trim()}</Text>
              ) : null}
            </Section>
          ) : null}

          <Section style={content}>{children}</Section>

          <Hr style={hr} />

          <Text style={footer}>
            {footerNote ?? "本邮件由玖莅代表活动主办方发送"}
          </Text>
          <Text style={footerMuted}>
            <Link href={SITE} style={footerLink}>
              9li.co
            </Link>
            {unsubscribeLink ? (
              <>
                {" · "}
                <Link href={unsubscribeLink} style={footerLink}>
                  退订
                </Link>
              </>
            ) : null}
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

const main = {
  backgroundColor: "#F3F5F8",
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", Arial, sans-serif',
  margin: "0",
  padding: "24px 12px",
};

const container = {
  backgroundColor: "#ffffff",
  margin: "0 auto",
  padding: "0 0 28px",
  borderRadius: "12px",
  maxWidth: "560px",
  overflow: "hidden" as const,
  border: "1px solid #E6EAF0",
};

const header = {
  backgroundColor: "#0F6E56",
  padding: "22px 28px 20px",
};

const logoText = {
  color: "#ffffff",
  fontSize: "18px",
  fontWeight: "700" as const,
  margin: "0",
  letterSpacing: "0.02em",
};

const logoSub = {
  color: "rgba(255,255,255,0.78)",
  fontSize: "12px",
  margin: "6px 0 0",
};

const eventCard = {
  margin: "20px 28px 0",
  padding: "14px 16px",
  backgroundColor: "#F0F7F4",
  borderRadius: "10px",
  border: "1px solid #D5EBE3",
};

const eventName = {
  color: "#0B3D2E",
  fontSize: "16px",
  fontWeight: "700" as const,
  margin: "0 0 8px",
  lineHeight: "1.4",
};

const eventMeta = {
  color: "#3D6B5A",
  fontSize: "13px",
  margin: "4px 0",
  lineHeight: "1.5",
};

const content = {
  padding: "8px 28px 0",
};

const hr = {
  borderColor: "#EEF1F5",
  margin: "24px 28px 16px",
};

const footer = {
  color: "#8A93A0",
  fontSize: "12px",
  textAlign: "center" as const,
  margin: "0 28px 6px",
  lineHeight: "1.5",
};

const footerMuted = {
  color: "#A0A8B3",
  fontSize: "11px",
  textAlign: "center" as const,
  margin: "0 28px",
};

const footerLink = {
  color: "#0F6E56",
  textDecoration: "none",
};
