import { Button, Heading, Section, Text } from "@react-email/components";
import {
  BrandEmailLayout,
  type BrandEmailEventInfo,
} from "@/lib/email-templates/brand-layout";

export type TransactionalEmailProps = {
  preview: string;
  heading: string;
  greeting?: string;
  paragraphs: string[];
  ctaLabel?: string;
  ctaUrl?: string;
  footnote?: string;
  event?: BrandEmailEventInfo | null;
  footerNote?: string;
  unsubscribeLink?: string;
};

export function TransactionalEmail({
  preview,
  heading,
  greeting,
  paragraphs,
  ctaLabel,
  ctaUrl,
  footnote,
  event,
  footerNote,
  unsubscribeLink,
}: TransactionalEmailProps) {
  return (
    <BrandEmailLayout
      preview={preview}
      event={event}
      footerNote={footerNote}
      unsubscribeLink={unsubscribeLink}
    >
      <Heading style={headingStyle}>{heading}</Heading>
      {greeting ? <Text style={bodyText}>{greeting}</Text> : null}
      {paragraphs.map((p, i) => (
        <Text key={i} style={bodyText}>
          {p}
        </Text>
      ))}
      {ctaLabel && ctaUrl ? (
        <Section style={buttonSection}>
          <Button style={button} href={ctaUrl}>
            {ctaLabel}
          </Button>
        </Section>
      ) : null}
      {ctaUrl ? (
        <Text style={linkFallback}>
          若按钮无法点击，请复制链接到浏览器打开：
          <br />
          {ctaUrl}
        </Text>
      ) : null}
      {footnote ? <Text style={footnoteStyle}>{footnote}</Text> : null}
    </BrandEmailLayout>
  );
}

const headingStyle = {
  color: "#1A2332",
  fontSize: "20px",
  fontWeight: "700" as const,
  lineHeight: "1.35",
  margin: "20px 0 12px",
};

const bodyText = {
  color: "#4A5565",
  fontSize: "15px",
  lineHeight: "1.7",
  margin: "0 0 12px",
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

const footnoteStyle = {
  color: "#8A93A0",
  fontSize: "12px",
  lineHeight: "1.6",
  margin: "16px 0 0",
};

export default TransactionalEmail;
