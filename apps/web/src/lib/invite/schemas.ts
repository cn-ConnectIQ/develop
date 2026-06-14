import {
  InviteChannel,
  ParticipantInviteStatus,
  ParticipantRole,
} from "@connectiq/database";
import { z } from "zod";

export const targetFilterSchema = z.object({
  ticket_types: z.array(z.string()).optional(),
  roles: z.nativeEnum(ParticipantRole).array().optional(),
  invite_status: z.nativeEnum(ParticipantInviteStatus).array().optional(),
  participant_ids: z.array(z.string()).optional(),
  exclude_activated: z.boolean().optional().default(true),
});

export const createInviteCampaignSchema = z.object({
  name: z.string().min(1).max(100),
  channel: z.nativeEnum(InviteChannel),
  template_id: z.string().optional(),
  subject: z.string().max(200).optional(),
  custom_message: z.string().min(1).max(2000),
  target_filter: targetFilterSchema.default({}),
  scheduled_at: z.string().datetime().nullable().optional(),
});

export type TargetFilterInput = z.infer<typeof targetFilterSchema>;
export type CreateInviteCampaignInput = z.infer<typeof createInviteCampaignSchema>;

export const completeActivationSchema = z.object({
  token: z.string().min(1),
  user_id: z.string().min(1),
});
