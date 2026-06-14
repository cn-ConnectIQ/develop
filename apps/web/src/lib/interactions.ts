import type { PollStatus, PollType } from "@connectiq/database";

export type PollListItem = {
  id: string;
  title: string;
  type: PollType | string;
  status: PollStatus | string;
  closesAt: string | null;
  scheduledAt: string | null;
  createdAt: string;
  updatedAt: string;
  options: Array<{ id: string; text: string }>;
  _count: { responses: number };
};

export type SessionOption = {
  id: string;
  title: string;
};

export const POLL_TYPE_LABELS: Record<string, string> = {
  SINGLE_CHOICE: "单选投票",
  MULTI_CHOICE: "多选投票",
  WORD_CLOUD: "词云",
  RATING: "评分",
  QNA: "提问",
  ANNOUNCEMENT: "公告",
};

export const POLL_TYPE_BADGE: Record<string, string> = {
  SINGLE_CHOICE: "bg-brand-blue-light text-brand-blue",
  MULTI_CHOICE: "bg-brand-green-light text-brand-green",
  WORD_CLOUD: "bg-brand-purple-light text-brand-purple",
  RATING: "bg-brand-amber-light text-brand-amber",
  QNA: "bg-brand-purple-light text-brand-purple",
  ANNOUNCEMENT: "bg-brand-amber-light text-brand-amber",
};

export function estimatePollMinutes(type: string, optionCount: number): number {
  switch (type) {
    case "RATING":
      return 1;
    case "WORD_CLOUD":
      return 2;
    case "QNA":
    case "ANNOUNCEMENT":
      return 3;
    default:
      return Math.max(2, Math.min(10, optionCount));
  }
}

export function formatRemainingMinutes(closesAt: string | null): string {
  if (!closesAt) return "";
  const diff = new Date(closesAt).getTime() - Date.now();
  if (diff <= 0) return "已结束";
  const mins = Math.ceil(diff / 60000);
  if (mins >= 60) return `剩余 ${Math.floor(mins / 60)} 小时 ${mins % 60} 分钟`;
  return `剩余 ${mins} 分钟`;
}
