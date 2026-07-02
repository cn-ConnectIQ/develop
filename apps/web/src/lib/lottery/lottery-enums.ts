/** 客户端安全的抽奖枚举，避免从 @connectiq/database 引入 pg */

export const LotteryDrawType = {
  INSTANT: "INSTANT",
  SCHEDULED: "SCHEDULED",
  MANUAL: "MANUAL",
} as const;

export type LotteryDrawType =
  (typeof LotteryDrawType)[keyof typeof LotteryDrawType];

export const LotteryStatus = {
  DRAFT: "DRAFT",
  ACTIVE: "ACTIVE",
  DRAWING: "DRAWING",
  ENDED: "ENDED",
  READY: "READY",
  OPEN: "OPEN",
  FINISHED: "FINISHED",
} as const;

export type LotteryStatus =
  (typeof LotteryStatus)[keyof typeof LotteryStatus];

export const LOTTERY_DRAW_TYPE_VALUES = [
  LotteryDrawType.INSTANT,
  LotteryDrawType.SCHEDULED,
  LotteryDrawType.MANUAL,
] as const;

export const LOTTERY_STATUS_VALUES = [
  LotteryStatus.DRAFT,
  LotteryStatus.ACTIVE,
  LotteryStatus.DRAWING,
  LotteryStatus.ENDED,
  LotteryStatus.READY,
  LotteryStatus.OPEN,
  LotteryStatus.FINISHED,
] as const;
