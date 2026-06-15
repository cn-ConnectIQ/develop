import type { PollStatus } from "@connectiq/database";
import type { PollListItem, SessionOption } from "@/lib/interactions";

export type LotteryListItem = {
  id: string;
  title: string;
  status: string;
  description?: string | null;
  prizes?: unknown;
  winnerCount?: number;
  allowReenter?: boolean;
  entryCount?: number;
  _count?: { entries: number; winners: number };
};

export type InteractionPollItem = PollListItem & {
  kind: "poll";
  showResults?: boolean;
};

export type InteractionLotteryItem = LotteryListItem & {
  kind: "lottery";
};

export type InteractionItem = InteractionPollItem | InteractionLotteryItem;

export type InteractionSelection =
  | { kind: "poll"; data: InteractionPollItem }
  | { kind: "lottery"; data: InteractionLotteryItem }
  | null;

export type InteractionsPageData = {
  polls: PollListItem[];
  lotteries: LotteryListItem[];
  sessions: SessionOption[];
};

export const INTERACTION_TYPE_SHORT: Record<string, string> = {
  SINGLE_CHOICE: "单选",
  MULTI_CHOICE: "多选",
  WORD_CLOUD: "词云",
  RATING: "评分",
  QNA: "问答",
  ANNOUNCEMENT: "公告",
  SURVEY: "问卷",
  LOTTERY: "抽奖",
};

export function isPollLive(status: string): boolean {
  return status === "LIVE" || status === "PAUSED";
}

export function isPollDraft(status: string): boolean {
  return status === "DRAFT";
}

export function isPollClosed(status: string): boolean {
  return status === "CLOSED";
}

export function isLotteryLive(status: string): boolean {
  return status === "OPEN" || status === "DRAWING";
}

export function isLotteryDraft(status: string): boolean {
  return status === "DRAFT" || status === "READY";
}

export function isLotteryClosed(status: string): boolean {
  return status === "FINISHED";
}

export function getInteractionResponseCount(item: InteractionItem): number {
  if (item.kind === "poll") return item._count.responses;
  return item.entryCount ?? item._count?.entries ?? 0;
}

export function mergeInteractions(
  polls: PollListItem[],
  lotteries: LotteryListItem[],
): InteractionItem[] {
  const pollItems: InteractionPollItem[] = polls.map((p) => ({
    ...p,
    kind: "poll" as const,
  }));
  const lotteryItems: InteractionLotteryItem[] = lotteries.map((l) => ({
    ...l,
    kind: "lottery" as const,
  }));

  const statusOrder = (item: InteractionItem) => {
    if (item.kind === "poll") {
      if (item.status === "LIVE") return 0;
      if (item.status === "PAUSED") return 1;
      if (item.status === "DRAFT") return 2;
      return 3;
    }
    if (isLotteryLive(item.status)) return 0;
    if (isLotteryDraft(item.status)) return 2;
    return 3;
  };

  return [...pollItems, ...lotteryItems].sort(
    (a, b) => statusOrder(a) - statusOrder(b),
  );
}

export function countInteractionStats(items: InteractionItem[]) {
  let live = 0;
  let draft = 0;
  for (const item of items) {
    if (item.kind === "poll") {
      if (item.status === "LIVE" || item.status === "PAUSED") live++;
      else if (item.status === "DRAFT") draft++;
    } else {
      if (isLotteryLive(item.status)) live++;
      else if (isLotteryDraft(item.status)) draft++;
    }
  }
  return { total: items.length, live, draft };
}

export function getDefaultPollOptions(type: string): string[] {
  switch (type) {
    case "SINGLE_CHOICE":
    case "MULTI_CHOICE":
      return ["选项 1", "选项 2"];
    case "ANNOUNCEMENT":
      return ["公告内容"];
    default:
      return [];
  }
}

export function getDefaultPollTitle(type: string): string {
  switch (type) {
    case "SINGLE_CHOICE":
      return "未命名单选投票";
    case "MULTI_CHOICE":
      return "未命名多选投票";
    case "WORD_CLOUD":
      return "未命名词云";
    case "RATING":
      return "未命名评分";
    case "QNA":
      return "未命名问答";
    case "ANNOUNCEMENT":
      return "未命名公告";
    default:
      return "未命名互动";
  }
}

export type RealtimePollResults = {
  pollId: string;
  title: string;
  type: string;
  status: PollStatus | string;
  showResults: boolean;
  closesAt: string | null;
  total: number;
  options: Array<{
    id: string;
    text: string;
    count: number;
    percentage: number;
  }>;
  wordCloud: Array<{ text: string; count: number; weight: number }>;
};
