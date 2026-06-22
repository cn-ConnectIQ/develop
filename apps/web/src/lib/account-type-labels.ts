import type { AccountType } from "@connectiq/database";

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  ORGANIZATION: "组织",
  CONFERENCE_ORGANIZER: "会议/沙龙/培训主办方",
  EXPO_ORGANIZER: "展览/展会主办方",
  EXHIBITOR: "参展商",
};

/** @deprecated 注册已改为组织审核，不再按身份类型申请 */
export const ACCOUNT_TYPE_OPTIONS: Array<{
  value: AccountType;
  icon: string;
  title: string;
  description: string;
}> = [
  {
    value: "CONFERENCE_ORGANIZER",
    icon: "🎤",
    title: "会议/沙龙/培训主办方",
    description: "举办会议、论坛、沙龙、培训类活动",
  },
  {
    value: "EXPO_ORGANIZER",
    icon: "🏛️",
    title: "展览/展会主办方",
    description: "举办行业展览、展会，管理参展商和买家",
  },
  {
    value: "EXHIBITOR",
    icon: "🏪",
    title: "参展商",
    description: "参加展会，在展位采集客户线索",
  },
];
