export type NotificationTemplateCode =
  | "SYS-01"
  | "SYS-02"
  | "SYS-04"
  | "SYS-05-SMS"
  | "SYS-05-MAIL"
  | "SYS-06"
  | "ATT-01"
  | "ATT-02"
  | "ATT-03"
  | "ATT-05"
  | "ATT-16"
  | "EXH-01-SMS"
  | "EXH-01-MAIL"
  | "EXH-06"
  | "ORG-01"
  | "ORG-04";

/** 激活类：发送时自动排除已启用用户 */
export const ACTIVATION_TEMPLATE_CODES = new Set<string>([
  "ATT-01",
  "ATT-02",
  "ATT-03",
  "ATT-05",
]);

/** 会后报告类邮件：不计入邮件频控 */
export const POST_EVENT_REPORT_CODES = new Set<string>([
  "ATT-16",
  "EXH-06",
  "ORG-04",
]);

export type AudienceFilterType =
  | "all_attendees"
  | "not_activated"
  | "activated_no_intent"
  | "all_exhibitors"
  | "booth"
  | "vip"
  | "custom";

export type AudienceFilter = {
  type: AudienceFilterType;
  booth_id?: string;
  industry?: string;
  title?: string;
  ticket_type_id?: string;
  source?: string;
  /** 短信选「全部参会者」时必须为 true */
  confirm_all_attendees_sms?: boolean;
};

export type NotifyPayload = Record<string, string | number | undefined | null>;

export type ChannelSendResult = {
  success: boolean;
  messageId?: string;
  error?: string;
  provider?: string;
};
