import { z } from "zod";
import {
  BigScreenAnimationType,
  type BigScreenAnimationTypeValue,
} from "@/lib/lottery/big-screen-animation-config";

function emptyToUndefined(value: unknown) {
  if (value === "" || value === null || value === undefined) return undefined;
  return value;
}

function emptyToNull(value: unknown) {
  if (value === "" || value === undefined) return null;
  return value;
}

const optionalCuid = z.preprocess(
  emptyToUndefined,
  z.string().cuid().optional(),
);

const optionalNullableCuid = z.preprocess(
  emptyToNull,
  z.string().cuid().nullable().optional(),
);

export const SCREEN_ANIMATION_OPTIONS = [
  {
    value: "SLOT_MACHINE",
    emoji: "🎰",
    title: "摇号机",
    description: "公正严肃，适合重要大奖、有公信力要求的场合",
    bestFor: "全场大奖",
    duration: "8–15s",
  },
  {
    value: "REVEAL_ONE_BY_ONE",
    emoji: "📜",
    title: "滚动名单",
    description: "名单高速滚动后定格，仪式感强、适合压轴揭晓",
    bestFor: "终极大奖",
    duration: "6–12s",
  },
  {
    value: "WHEEL",
    emoji: "🎡",
    title: "转盘",
    description: "视觉华丽，适合大屏投影",
    bestFor: "展位",
    duration: "8–15s",
  },
  {
    value: "RED_ENVELOPE",
    emoji: "🎊",
    title: "红包雨",
    description: "热闹氛围，调动全场情绪",
    bestFor: "暖场",
    duration: "5–10s",
  },
  {
    value: "STARLIGHT_ORBIT",
    emoji: "🌌",
    title: "星轨流转",
    description: "科技感轨道旋转，适合未来主题现场",
    bestFor: "科技场",
    duration: "8–12s",
  },
  {
    value: "PRECISION_ROLLER",
    emoji: "🔢",
    title: "精工数轮",
    description: "机械滚轮逐字定格，精密公正",
    bestFor: "正式场",
    duration: "6–10s",
  },
  {
    value: "SCROLL_UNVEILING",
    emoji: "🏮",
    title: "卷轴揭榜",
    description: "水墨卷轴徐徐展开，文化庄重",
    bestFor: "文化场",
    duration: "6–12s",
  },
] as const;

/** 大屏全场抽奖（BS1）：设计稿为二选一 */
export const GRAND_SCREEN_ANIMATION_OPTIONS = SCREEN_ANIMATION_OPTIONS.filter(
  (o) => o.value === "SLOT_MACHINE" || o.value === "REVEAL_ONE_BY_ONE",
);

export type ScreenAnimationType =
  (typeof SCREEN_ANIMATION_OPTIONS)[number]["value"];

export type OrganizerLotteryEligibility = {
  require_checkin: boolean;
  min_interactions: number | null;
  require_stamp_rally: boolean;
  stamp_rally_id: string | null;
  min_connections: number | null;
  /** 允许扫码直接加入奖池（无需满足其它门槛） */
  allow_scan_join: boolean;
};

/** ASC = 从低等级到高等级依次开奖（先三等奖，压轴一等奖）；ALL_AT_ONCE = 不分级逐步控制 */
export type PrizeDrawOrder = "ASC" | "ALL_AT_ONCE";

export type OrganizerLotteryMeta = {
  eligibility: OrganizerLotteryEligibility;
  /** POOL_DRAW 大屏动效（存于 lotteries.big_screen_animation_type） */
  big_screen_animation_type: BigScreenAnimationTypeValue;
  prize_draw_order: PrizeDrawOrder;
  target_entry_count: number | null;
  /** 大屏分级开奖时当前进行中的等级（tier 数字） */
  active_draw_tier: number | null;
};

export const defaultOrganizerEligibility = (): OrganizerLotteryEligibility => ({
  require_checkin: true,
  min_interactions: null,
  require_stamp_rally: false,
  stamp_rally_id: null,
  min_connections: null,
  allow_scan_join: false,
});

export function normalizeOrganizerEligibility(
  raw: Partial<OrganizerLotteryEligibility> | undefined,
): OrganizerLotteryEligibility {
  const defaults = defaultOrganizerEligibility();
  const stampRallyId =
    typeof raw?.stamp_rally_id === "string" && raw.stamp_rally_id.trim()
      ? raw.stamp_rally_id.trim()
      : null;

  return {
    require_checkin: raw?.require_checkin ?? defaults.require_checkin,
    min_interactions:
      typeof raw?.min_interactions === "number" && raw.min_interactions > 0
        ? raw.min_interactions
        : null,
    require_stamp_rally:
      raw?.require_stamp_rally ?? defaults.require_stamp_rally,
    stamp_rally_id: stampRallyId,
    min_connections:
      typeof raw?.min_connections === "number" && raw.min_connections > 0
        ? raw.min_connections
        : null,
    allow_scan_join: raw?.allow_scan_join ?? defaults.allow_scan_join,
  };
}

export const defaultOrganizerMeta = (): OrganizerLotteryMeta => ({
  eligibility: defaultOrganizerEligibility(),
  big_screen_animation_type: BigScreenAnimationType.ROLLING_MACHINE,
  prize_draw_order: "ASC",
  target_entry_count: null,
  active_draw_tier: null,
});

export function tierMedal(tier: number): string {
  if (tier === 1) return "🥇";
  if (tier === 2) return "🥈";
  if (tier === 3) return "🥉";
  return "🎁";
}

export function tierLabel(tier: number): string {
  const labels: Record<number, string> = {
    1: "一等奖",
    2: "二等奖",
    3: "三等奖",
  };
  return labels[tier] ?? `${tier}等奖`;
}

export const organizerEligibilitySchema = z.object({
  require_checkin: z.boolean().optional(),
  min_interactions: z.number().int().min(1).max(100).optional().nullable(),
  require_stamp_rally: z.boolean().optional(),
  stamp_rally_id: optionalNullableCuid,
  min_connections: z.number().int().min(1).max(100).optional().nullable(),
  allow_scan_join: z.boolean().optional(),
});

export const createOrganizerLotterySchema = z.object({
  id: optionalCuid,
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  cover_image: z.string().optional().nullable(),
  prizes: z
    .array(
      z.object({
        name: z.string().min(1).max(100),
        image_url: z.string().optional().nullable(),
        quantity: z.number().int().positive().max(10000),
        tier: z.number().int().positive().max(99).optional(),
        prize_type: z
          .enum(["PHYSICAL", "DIGITAL", "EXPERIENCE"])
          .default("PHYSICAL"),
      }),
    )
    .min(1),
  draw_at: z.string().datetime().optional().nullable(),
  eligibility: organizerEligibilitySchema.optional(),
  big_screen_animation_type: z.nativeEnum(BigScreenAnimationType).optional(),
  /** @deprecated 请使用 big_screen_animation_type */
  screen_animation: z
    .enum([
      "SLOT_MACHINE",
      "WHEEL",
      "RED_ENVELOPE",
      "STARLIGHT_ORBIT",
      "PRECISION_ROLLER",
      "SCROLL_UNVEILING",
      "REVEAL_ONE_BY_ONE",
    ])
    .optional(),
  prize_draw_order: z.enum(["ASC", "ALL_AT_ONCE"]).optional(),
  target_entry_count: z.number().int().positive().optional().nullable(),
  publish: z.boolean().optional(),
});

export type CreateOrganizerLotteryInput = z.infer<
  typeof createOrganizerLotterySchema
>;

export type OrganizerLotteryScanJoin = {
  session_id: string;
  session_code: string;
  qr_url: string | null;
  scan_url: string;
};

export type OrganizerLotteryDto = {
  id: string;
  title: string;
  description: string | null;
  cover_image: string | null;
  status: string;
  draw_at: string | null;
  entry_count: number;
  winner_count: number;
  prizes: Array<{
    id?: string;
    name: string;
    image_url: string | null;
    quantity: number;
    tier: number;
    prize_type: string;
    sort_order: number;
  }>;
  meta: OrganizerLotteryMeta;
  /** 开启扫码加入时的互动码 */
  scan_join: OrganizerLotteryScanJoin | null;
  created_at: string;
};

export const eligibleCountQuerySchema = z.object({
  lottery_id: optionalCuid,
  require_checkin: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),
  min_interactions: z.coerce.number().int().min(1).max(100).optional(),
  require_stamp_rally: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),
  stamp_rally_id: optionalCuid,
  min_connections: z.coerce.number().int().min(1).max(100).optional(),
  target_entry_count: z.coerce.number().int().positive().optional(),
});
