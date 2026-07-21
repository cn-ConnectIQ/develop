import { Heading, Text } from "@react-email/components";
import {
  BrandEmailLayout,
  type BrandEmailEventInfo,
} from "@/lib/email-templates/brand-layout";
import { EmailCtaButton } from "@/lib/email-templates/cta-button";

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
        <EmailCtaButton href={ctaUrl} label={ctaLabel} />
      ) : null}
      {ctaUrl ? (
        <>
          <Text style={linkFallback}>
            若按钮无法点击，请复制以下链接到浏览器打开：
          </Text>
          <Text style={linkBox}>{ctaUrl}</Text>
        </>
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

const footnoteStyle = {
  color: "#8A93A0",
  fontSize: "12px",
  lineHeight: "1.6",
  margin: "16px 0 0",
};

export default TransactionalEmail;
