import {
  InviteChannel,
  ParticipantInviteStatus,
  ParticipantRole,
} from "@connectiq/database";
import { z } from "zod";

export const importContactSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  phone: z.string().max(32).optional(),
  email: z.string().email().optional().or(z.literal("")),
  company: z.string().max(100).optional(),
});

export const targetFilterSchema = z.object({
  ticket_types: z.array(z.string()).optional(),
  roles: z.nativeEnum(ParticipantRole).array().optional(),
  invite_status: z.nativeEnum(ParticipantInviteStatus).array().optional(),
  participant_ids: z.array(z.string()).optional(),
  /** 参会者 tags 命中任一即可 */
  tags: z.array(z.string()).optional(),
  /** Excel/CSV 导入的联系人（发送前会 upsert 为 Participant） */
  import_contacts: z.array(importContactSchema).max(20000).optional(),
  exclude_activated: z.boolean().optional().default(true),
});

export const createInviteCampaignSchema = z.object({
  name: z.string().min(1).max(100),
  channel: z.nativeEnum(InviteChannel),
  template_id: z.string().optional(),
  /** 已废弃：服务端始终使用固定主题 */
  subject: z.string().max(200).optional(),
  /** 已废弃：服务端始终使用固定模板，可不传 */
  custom_message: z.string().max(2000).optional(),
  target_filter: targetFilterSchema.default({}),
  scheduled_at: z.string().datetime().nullable().optional(),
});

export type TargetFilterInput = z.infer<typeof targetFilterSchema>;
export type CreateInviteCampaignInput = z.infer<typeof createInviteCampaignSchema>;
export type ImportContactInput = z.infer<typeof importContactSchema>;

export const completeActivationSchema = z.object({
  token: z.string().min(1),
  user_id: z.string().min(1),
});
