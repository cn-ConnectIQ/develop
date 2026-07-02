import { z } from "zod";
import { STAMP_EMOJI_OPTIONS } from "@/lib/stamp/stamp-rally-config";

export const boothCheckpointSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1).max(100),
  icon: z.string().max(500).optional().nullable(),
});

export const upsertBoothStampRallySchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  prize: z.string().min(1).max(500),
  prize_image_url: z.string().optional().nullable(),
  prize_desc: z.string().max(2000).optional().nullable(),
  checkpoints: z.array(boothCheckpointSchema).min(1).max(20),
  require_all: z.boolean().optional(),
  required_count: z.number().int().min(1).optional(),
  publish: z.boolean().optional(),
});

export type UpsertBoothStampRallyInput = z.infer<
  typeof upsertBoothStampRallySchema
>;

export type BoothCheckpointDto = {
  id: string;
  name: string;
  icon: string | null;
  scan_code: string;
  scan_url: string;
  qr_url: string;
  collect_count: number;
  sort_order: number;
};

export type BoothStampRallyDto = {
  id: string;
  name: string;
  description: string | null;
  prize: string;
  prize_image_url: string | null;
  prize_desc: string | null;
  required_count: number;
  require_all: boolean;
  total_checkpoints: number;
  status: string;
  participant_count: number;
  completed_count: number;
  checkpoints: BoothCheckpointDto[];
  created_at: string;
  updated_at: string;
};

export const DEFAULT_CHECKPOINT_NAMES = [
  "产品演示区",
  "客户案例区",
  "技术体验区",
] as const;

export const BOOTH_CHECKPOINT_EMOJIS = STAMP_EMOJI_OPTIONS;
