import {
  LOTTERY_DRAW_TYPE_VALUES,
  LotteryDrawType,
} from "@/lib/lottery/lottery-enums";
import { z } from "zod";

const prizeItemSchema = z.object({
  name: z.string().min(1).max(100),
  image_url: z.string().url().optional().nullable().or(z.literal("")),
  quantity: z.number().int().positive().max(10000),
  prize_type: z.enum(["PHYSICAL", "DIGITAL", "EXPERIENCE"]).default("PHYSICAL"),
});

const leadFormFieldSchema = z.object({
  id: z.string().min(1),
  type: z.enum([
    "text",
    "phone",
    "email",
    "select",
    "multiselect",
    "textarea",
  ]),
  label: z.string().min(1),
  placeholder: z.string().optional(),
  required: z.boolean(),
  options: z.array(z.string()).optional(),
  prefill_from: z
    .enum(["user.name", "user.phone", "user.company", "user.title"])
    .optional(),
  sortOrder: z.number().int().optional(),
});

export const createBoothLotterySchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  prizes: z.array(prizeItemSchema).min(1),
  draw_type: z.enum(LOTTERY_DRAW_TYPE_VALUES).default(LotteryDrawType.INSTANT),
  draw_at: z.string().datetime().optional().nullable(),
  require_lead_capture: z.boolean().default(true),
  lead_form_config: z
    .union([
      z.object({ fields: z.array(leadFormFieldSchema) }),
      z.array(leadFormFieldSchema),
    ])
    .optional(),
  unlimited_entries: z.boolean().default(false),
  publish: z.boolean().default(false),
});

export type CreateBoothLotteryInput = z.infer<typeof createBoothLotterySchema>;

export type BoothLotteryPrizeDraft = z.infer<typeof prizeItemSchema>;
