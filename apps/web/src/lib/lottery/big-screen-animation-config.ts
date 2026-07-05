import type { ScreenAnimationType } from "@/lib/lottery/organizer-lottery-config";

/** 与 Prisma BigScreenAnimationType 一致，供客户端组件安全引用（勿从 @connectiq/database 导入） */
export const BigScreenAnimationType = {
  ROLLING_MACHINE: "ROLLING_MACHINE",
  SPOTLIGHT_SCROLL: "SPOTLIGHT_SCROLL",
  REEL_OF_HONOR: "REEL_OF_HONOR",
  STARLIGHT_ORBIT: "STARLIGHT_ORBIT",
  PRECISION_ROLLER: "PRECISION_ROLLER",
  SCROLL_UNVEILING: "SCROLL_UNVEILING",
} as const;

export type BigScreenAnimationTypeValue =
  (typeof BigScreenAnimationType)[keyof typeof BigScreenAnimationType];

export const BIG_SCREEN_ANIMATION_OPTIONS = [
  {
    value: BigScreenAnimationType.ROLLING_MACHINE,
    title: "摇号机",
    tagline: "公正严肃",
  },
  {
    value: BigScreenAnimationType.SPOTLIGHT_SCROLL,
    title: "滚动名单",
    tagline: "悬念连贯",
  },
  {
    value: BigScreenAnimationType.REEL_OF_HONOR,
    title: "荣耀转轮",
    tagline: "正式庆典",
  },
  {
    value: BigScreenAnimationType.STARLIGHT_ORBIT,
    title: "星轨流转",
    tagline: "科技未来",
  },
  {
    value: BigScreenAnimationType.PRECISION_ROLLER,
    title: "精工数轮",
    tagline: "精密公正",
  },
  {
    value: BigScreenAnimationType.SCROLL_UNVEILING,
    title: "卷轴揭榜",
    tagline: "文化庄重",
  },
] as const;

export const BIG_SCREEN_ANIMATION_VALUES = BIG_SCREEN_ANIMATION_OPTIONS.map(
  (o) => o.value,
) as [BigScreenAnimationTypeValue, ...BigScreenAnimationTypeValue[]];

const LEGACY_TO_BIG_SCREEN: Record<string, BigScreenAnimationTypeValue> = {
  SLOT_MACHINE: BigScreenAnimationType.ROLLING_MACHINE,
  REVEAL_ONE_BY_ONE: BigScreenAnimationType.SPOTLIGHT_SCROLL,
  WHEEL: BigScreenAnimationType.REEL_OF_HONOR,
  RED_ENVELOPE: BigScreenAnimationType.STARLIGHT_ORBIT,
};

/** 旧 meta.screen_animation → 新库表枚举 */
export function normalizeBigScreenAnimationType(
  raw: string | null | undefined,
): BigScreenAnimationTypeValue {
  if (!raw) return BigScreenAnimationType.ROLLING_MACHINE;
  if (
    BIG_SCREEN_ANIMATION_VALUES.includes(raw as BigScreenAnimationTypeValue)
  ) {
    return raw as BigScreenAnimationTypeValue;
  }
  return LEGACY_TO_BIG_SCREEN[raw] ?? BigScreenAnimationType.ROLLING_MACHINE;
}

/** 大屏动效 → 旧运行时标识（BS9 投影兼容） */
export function bigScreenToLegacyAnimation(
  type: BigScreenAnimationTypeValue,
): ScreenAnimationType {
  switch (type) {
    case BigScreenAnimationType.ROLLING_MACHINE:
      return "SLOT_MACHINE";
    case BigScreenAnimationType.SPOTLIGHT_SCROLL:
      return "REVEAL_ONE_BY_ONE";
    case BigScreenAnimationType.SCROLL_UNVEILING:
      return "SCROLL_UNVEILING";
    case BigScreenAnimationType.REEL_OF_HONOR:
      return "WHEEL";
    case BigScreenAnimationType.STARLIGHT_ORBIT:
      return "STARLIGHT_ORBIT";
    case BigScreenAnimationType.PRECISION_ROLLER:
      return "PRECISION_ROLLER";
    default:
      return "SLOT_MACHINE";
  }
}

export function bigScreenAnimationLabel(type: BigScreenAnimationTypeValue): string {
  return (
    BIG_SCREEN_ANIMATION_OPTIONS.find((o) => o.value === type)?.title ?? type
  );
}
