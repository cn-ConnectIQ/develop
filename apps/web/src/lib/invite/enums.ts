/** 客户端安全枚举（勿从 @connectiq/database 导入，会拉入 pg） */

export const InviteChannel = {
  SMS: "SMS",
  EMAIL: "EMAIL",
  WECHAT: "WECHAT",
} as const;
export type InviteChannel = (typeof InviteChannel)[keyof typeof InviteChannel];

export const InviteCampaignStatus = {
  DRAFT: "DRAFT",
  SENDING: "SENDING",
  SENT: "SENT",
  FAILED: "FAILED",
  SCHEDULED: "SCHEDULED",
} as const;
export type InviteCampaignStatus =
  (typeof InviteCampaignStatus)[keyof typeof InviteCampaignStatus];

export const InviteRecordStatus = {
  PENDING: "PENDING",
  SENT: "SENT",
  DELIVERED: "DELIVERED",
  CLICKED: "CLICKED",
  ACTIVATED: "ACTIVATED",
  FAILED: "FAILED",
  SKIPPED: "SKIPPED",
} as const;
export type InviteRecordStatus =
  (typeof InviteRecordStatus)[keyof typeof InviteRecordStatus];

export const ParticipantInviteStatus = {
  NOT_INVITED: "NOT_INVITED",
  INVITED: "INVITED",
  CLICKED: "CLICKED",
  ACTIVATED: "ACTIVATED",
} as const;
export type ParticipantInviteStatus =
  (typeof ParticipantInviteStatus)[keyof typeof ParticipantInviteStatus];

export const ParticipantRole = {
  ATTENDEE: "ATTENDEE",
  SPEAKER: "SPEAKER",
} as const;
export type ParticipantRole =
  (typeof ParticipantRole)[keyof typeof ParticipantRole];
