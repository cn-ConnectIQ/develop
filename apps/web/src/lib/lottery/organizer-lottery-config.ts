import { z } from "zod";

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
    title: "老虎机滚动",
    description: "经典滚动抽名，节奏紧凑",
  },
  {
    value: "WHEEL",
    emoji: "🎡",
    title: "转盘",
    description: "视觉华丽，适合大屏投影",
  },
  {
    value: "RED_ENVELOPE",
    emoji: "🎊",
    title: "红包雨",
    description: "热闹氛围，调动全场情绪",
  },
  {
    value: "REVEAL_ONE_BY_ONE",
    emoji: "🏆",
    title: "逐一揭晓",
    description: "庄重仪式感，适合终极大奖",
  },
] as const;

export type ScreenAnimationType =
  (typeof SCREEN_ANIMATION_OPTIONS)[number]["value"];

export type OrganizerLotteryEligibility = {
  require_checkin: boolean;
  min_interactions: number | null;
  require_stamp_rally: boolean;
  stamp_rally_id: string | null;
  min_connections: number | null;
};

export type OrganizerLotteryMeta = {
  eligibility: OrganizerLotteryEligibility;
  screen_animation: ScreenAnimationType;
  prize_draw_order: "ASC";
  target_entry_count: number | null;
};

export const defaultOrganizerEligibility = (): OrganizerLotteryEligibility => ({
  require_checkin: true,
  min_interactions: null,
  require_stamp_rally: false,
  stamp_rally_id: null,
  min_connections: null,
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
  };
}

export const defaultOrganizerMeta = (): OrganizerLotteryMeta => ({
  eligibility: defaultOrganizerEligibility(),
  screen_animation: "SLOT_MACHINE",
  prize_draw_order: "ASC",
  target_entry_count: null,
});

export const organizerEligibilitySchema = z.object({
  require_checkin: z.boolean().optional(),
  min_interactions: z.number().int().min(1).max(100).optional().nullable(),
  require_stamp_rally: z.boolean().optional(),
  stamp_rally_id: optionalNullableCuid,
  min_connections: z.number().int().min(1).max(100).optional().nullable(),
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
        prize_type: z
          .enum(["PHYSICAL", "DIGITAL", "EXPERIENCE"])
          .default("PHYSICAL"),
      }),
    )
    .min(1),
  draw_at: z.string().datetime().optional().nullable(),
  eligibility: organizerEligibilitySchema.optional(),
  screen_animation: z
    .enum(["SLOT_MACHINE", "WHEEL", "RED_ENVELOPE", "REVEAL_ONE_BY_ONE"])
    .optional(),
  target_entry_count: z.number().int().positive().optional().nullable(),
  publish: z.boolean().optional(),
});

export type CreateOrganizerLotteryInput = z.infer<
  typeof createOrganizerLotterySchema
>;

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
    prize_type: string;
    sort_order: number;
  }>;
  meta: OrganizerLotteryMeta;
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
