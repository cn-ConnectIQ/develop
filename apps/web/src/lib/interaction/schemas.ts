import { LotteryStatus, LotteryType } from "@connectiq/database";
import { z } from "zod";

export const lotteryPrizeSchema = z.object({
  rank: z.number().int().positive(),
  name: z.string().min(1),
  prize: z.string().min(1),
  count: z.number().int().positive().default(1),
  image_url: z.string().optional(),
});

export const createLotterySchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  type: z.nativeEnum(LotteryType).optional(),
  prizes: z.array(lotteryPrizeSchema).default([]),
  require_checkin: z.boolean().optional(),
  require_poll_id: z.string().cuid().optional().nullable(),
  eligible_roles: z.array(z.string()).optional(),
  quiz_poll_id: z.string().cuid().optional().nullable(),
  winner_count: z.number().int().positive().optional(),
  allow_reenter: z.boolean().optional(),
  booth_id: z.string().cuid().optional().nullable(),
});

export const patchLotterySchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional().nullable(),
  type: z.nativeEnum(LotteryType).optional(),
  status: z.nativeEnum(LotteryStatus).optional(),
  prizes: z.array(lotteryPrizeSchema).optional(),
  require_checkin: z.boolean().optional(),
  require_poll_id: z.string().cuid().optional().nullable(),
  eligible_roles: z.array(z.string()).optional(),
  quiz_poll_id: z.string().cuid().optional().nullable(),
  winner_count: z.number().int().positive().optional(),
  allow_reenter: z.boolean().optional(),
});

export const drawLotterySchema = z.object({
  prize_rank: z.number().int().positive(),
  count: z.number().int().positive().default(1),
});

export const interactionRefSchema = z.object({
  type: z.enum(["poll", "lottery"]),
  id: z.string().cuid(),
});

export const createInteractionSessionSchema = z.object({
  name: z.string().min(1).max(200),
  interactions: z.array(interactionRefSchema).min(1),
  booth_id: z.string().cuid().optional().nullable(),
  channel_type: z.enum(["QR_CODE", "LINK", "APP_PUSH"]).optional(),
});

export const participateSessionSchema = z.object({
  user_id: z.string().cuid().optional().nullable(),
  poll_response: z
    .object({
      poll_id: z.string().cuid(),
      option_id: z.string().cuid().optional(),
      option_ids: z.array(z.string().cuid()).optional(),
      text_answer: z.string().max(500).optional(),
      rating: z.number().int().min(1).max(5).optional(),
    })
    .optional(),
});

/** @deprecated 使用 participateSessionSchema */
export const joinSessionSchema = z.object({
  user_id: z.string().cuid().optional().nullable(),
});

export const createBoothInteractionSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("poll"),
    title: z.string().min(1).max(200),
    type: z.enum(["SINGLE_CHOICE", "MULTI_CHOICE", "WORD_CLOUD", "RATING"]),
    options: z.array(z.string().min(1)).optional(),
    publish_immediately: z.boolean().default(true),
    time_limit_minutes: z.number().int().min(1).max(120).optional(),
  }),
  z.object({
    kind: z.literal("lottery"),
    title: z.string().min(1).max(200),
    type: z.nativeEnum(LotteryType).optional(),
    prizes: z.array(lotteryPrizeSchema).default([]),
    winner_count: z.number().int().positive().optional(),
    publish_immediately: z.boolean().default(true),
  }),
]);

export const regenerateBoothInteractionQrSchema = z.object({
  session_id: z.string().cuid(),
});

export type LotteryPrizeConfig = z.infer<typeof lotteryPrizeSchema>;
export type InteractionRef = z.infer<typeof interactionRefSchema>;
export type CreateBoothInteractionInput = z.infer<
  typeof createBoothInteractionSchema
>;
