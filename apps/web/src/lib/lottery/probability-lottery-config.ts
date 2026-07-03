/** 类型② 概率抽奖 · 客户端安全枚举与选项 */

export const AnimationType = {
  WHEEL: "WHEEL",
  GRID: "GRID",
  SLOT: "SLOT",
  SPOTLIGHT: "SPOTLIGHT",
  PACHINKO: "PACHINKO",
  GIFT_RAIN: "GIFT_RAIN",
} as const;

export type AnimationTypeValue =
  (typeof AnimationType)[keyof typeof AnimationType];

export const TriggerAction = {
  FILL_FORM: "FILL_FORM",
  SURVEY: "SURVEY",
  SCAN_ONLY: "SCAN_ONLY",
} as const;

export type TriggerActionValue =
  (typeof TriggerAction)[keyof typeof TriggerAction];

export const ANIMATION_TYPE_OPTIONS = [
  {
    value: AnimationType.WHEEL,
    emoji: "🎡",
    title: "转盘",
    description: "经典大转盘，指针停落即出结果",
    previewClass: "bg-gradient-conic from-brand-gold/30 via-transparent to-brand-blue/20",
  },
  {
    value: AnimationType.GRID,
    emoji: "⬜",
    title: "九宫格",
    description: "格子跑马灯，适合多奖品展示",
    previewClass: "grid grid-cols-3 gap-0.5 p-2",
  },
  {
    value: AnimationType.SLOT,
    emoji: "🎰",
    title: "老虎机",
    description: "三列滚动，节奏感强",
    previewClass: "flex gap-1 justify-center",
  },
  {
    value: AnimationType.SPOTLIGHT,
    emoji: "🔦",
    title: "名单扫光",
    description: "参会者名单扫光定格",
    previewClass: "bg-gradient-to-r from-transparent via-brand-gold/40 to-transparent",
  },
  {
    value: AnimationType.PACHINKO,
    emoji: "🎱",
    title: "弹球",
    description: "弹珠落袋，趣味互动",
    previewClass: "rounded-full bg-brand-blue/20",
  },
  {
    value: AnimationType.GIFT_RAIN,
    emoji: "🎁",
    title: "红包雨",
    description: "礼物雨落下揭晓",
    previewClass: "bg-gradient-to-b from-brand-gold/30 to-transparent",
  },
] as const;

export const TRIGGER_ACTION_OPTIONS = [
  {
    value: TriggerAction.FILL_FORM,
    title: "填写表单后自动抽奖",
    description: "关联展位 SYS-01 留资字段，提交后触发",
  },
  {
    value: TriggerAction.SURVEY,
    title: "填写问卷后自动抽奖",
    description: "关联活动 Poll 问卷，完成后触发",
  },
  {
    value: TriggerAction.SCAN_ONLY,
    title: "仅扫码即触发",
    description: "扫码进入即可抽奖，无需额外动作",
  },
] as const;

export type ProbabilityPrizeDraft = {
  name: string;
  quantity: number;
  /** 0–100 百分比 */
  probability_percent: number;
  image_url?: string | null;
  prize_type?: "PHYSICAL" | "DIGITAL" | "EXPERIENCE";
};

export function sumProbabilityPercent(prizes: ProbabilityPrizeDraft[]): number {
  return prizes.reduce((sum, p) => sum + (p.probability_percent || 0), 0);
}

export function remainingProbabilityPercent(prizes: ProbabilityPrizeDraft[]): number {
  return Math.max(0, 100 - sumProbabilityPercent(prizes));
}

export function isProbabilityValid(prizes: ProbabilityPrizeDraft[]): boolean {
  const sum = sumProbabilityPercent(prizes);
  return sum > 0 && sum <= 100 + 1e-6;
}

export function percentToUnit(percent: number): number {
  return Math.round(percent * 10000) / 1_000_000;
}

export function unitToPercent(unit: number): number {
  return Math.round(unit * 10000) / 100;
}
