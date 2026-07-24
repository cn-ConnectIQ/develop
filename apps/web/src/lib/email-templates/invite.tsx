import { Heading, Img, Text } from "@react-email/components";
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
  /** 微信小程序码图（HTTPS 或 data URL） */
  wxacodeImageUrl?: string | null;
};

export function InviteEmail({
  participantName,
  eventName,
  eventDate,
  eventLocation,
  organizerName,
  activationLink,
  unsubscribeLink,
  wxacodeImageUrl,
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
        请使用微信扫描下方小程序码（含专属邀请 Token），或点击按钮直接打开玖莅小程序，完成入场激活。激活后即可使用现场互动、扫码连接与活动服务。
      </Text>

      {wxacodeImageUrl ? (
        <>
          <Text style={qrHint}>微信扫一扫 · 带 Token 直达小程序</Text>
          <Img
            src={wxacodeImageUrl}
            width={180}
            height={180}
            alt="玖莅邀请小程序码"
            style={qrImage}
          />
        </>
      ) : (
        <Text style={qrMissing}>
          （小程序码生成中，请先点击下方按钮用微信打开链接完成激活）
        </Text>
      )}

      <EmailCtaButton href={activationLink} label="打开玖莅小程序，完成激活" />
      <Text style={linkFallback}>
        若按钮无法点击，请复制以下链接到微信中打开（可直达小程序）：
      </Text>
      <Text style={linkBox}>{activationLink}</Text>
      <Text style={footnote}>此邀请仅限您本人使用，请勿转发他人。</Text>
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

const qrHint = {
  color: "#0F6E56",
  fontSize: "13px",
  fontWeight: "600" as const,
  textAlign: "center" as const,
  margin: "20px 0 10px",
};

const qrImage = {
  display: "block",
  margin: "0 auto 18px",
  borderRadius: "12px",
  border: "1px solid #E6EAF0",
};

const qrMissing = {
  color: "#8A93A0",
  fontSize: "12px",
  textAlign: "center" as const,
  margin: "16px 0",
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
