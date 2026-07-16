import { InviteChannel, ParticipantSource } from "@connectiq/database";
import { ErrorCode } from "@connectiq/types";
import { z } from "zod";
import {
  ApiError,
  createErrorResponse,
  createSuccessResponse,
  requireEventAccess,
  withErrorHandler,
} from "@/lib/api-auth";
import { guardEventFeature } from "@/lib/event-feature-flag-guard";
import { mergeParticipantByPhone } from "@/lib/participant-merge";
import { normalizeParticipantTags } from "@/lib/participant-tags";
import { triggerInviteProcessing } from "@/lib/invite/queue";
import {
  FIXED_PARTICIPANT_INVITE_SUBJECT,
  FIXED_PARTICIPANT_INVITE_TEMPLATE,
} from "@/lib/invite/message";
import { prepareCampaignSend } from "@/lib/invite/service";
import {
  assertExperienceCanSendInvite,
  ExperienceAccountError,
} from "@/lib/experience/experience-account-service";
import { prisma } from "@connectiq/database";

const contactSchema = z.object({
  name: z.string().min(1),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  tags: z.array(z.string()).optional(),
});

const sendInviteSchema = z.object({
  contacts: z.array(contactSchema).min(1),
  channel: z.nativeEnum(InviteChannel),
  /** 已废弃：服务端始终使用固定模板，传入会被忽略 */
  custom_message: z.string().max(2000).optional(),
  tags: z.array(z.string()).optional(),
  send_now: z.boolean().optional(),
});

export const POST = withErrorHandler(async (request, context) => {
  const eventId = context?.params?.eventId;
  if (!eventId) {
    return createErrorResponse("缺少活动 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  const { session } = await requireEventAccess(eventId);
  const disabled = await guardEventFeature(eventId, "inviteSystem");
  if (disabled) return disabled;

  const body = await request.json();
  const parsed = sendInviteSchema.safeParse(body);
  if (!parsed.success) {
    return createErrorResponse(
      parsed.error.issues[0]?.message ?? "参数错误",
      ErrorCode.VALIDATION_ERROR,
      400,
    );
  }

  try {
    await assertExperienceCanSendInvite(session.user.id, parsed.data.channel);
  } catch (error) {
    if (error instanceof ExperienceAccountError) {
      return createErrorResponse(error.message, ErrorCode.FORBIDDEN, 403);
    }
    throw error;
  }

  const defaultTags = normalizeParticipantTags(parsed.data.tags);
  const participantIds: string[] = [];
  let merged = 0;
  let created = 0;

  for (const contact of parsed.data.contacts) {
    if (!contact.phone?.trim() && !contact.email?.trim()) continue;

    const tags = normalizeParticipantTags([
      ...defaultTags,
      ...(contact.tags ?? []),
    ]);

    const result = await mergeParticipantByPhone(eventId, {
      name: contact.name,
      phone: contact.phone,
      email: contact.email || null,
      tags,
      source: ParticipantSource.INVITE,
    });

    participantIds.push(result.participant.id);
    if (result.created) created++;
    if (result.merged) merged++;
  }

  if (participantIds.length === 0) {
    return createErrorResponse(
      "请至少提供一个有效的手机号或邮箱",
      ErrorCode.VALIDATION_ERROR,
      400,
    );
  }

  const campaign = await prisma.inviteCampaign.create({
    data: {
      eventId,
      createdBy: session.user.id,
      name: `定向邀请 ${new Date().toLocaleString("zh-CN")}`,
      channel: parsed.data.channel,
      customMessage: FIXED_PARTICIPANT_INVITE_TEMPLATE,
      subject: FIXED_PARTICIPANT_INVITE_SUBJECT,
      targetFilter: { participant_ids: participantIds },
      totalTarget: participantIds.length,
    },
  });

  if (parsed.data.send_now !== false) {
    try {
      const result = await prepareCampaignSend(campaign.id);
      if (!result.isScheduled && result.queued > 0) {
        await triggerInviteProcessing(campaign.id);
      }
    } catch (error) {
      if (error instanceof ApiError && error.status === 402) {
        return Response.json(
          {
            error: error.message,
            code: error.code,
            reason: "INSUFFICIENT_INVITE_CREDIT",
            redirect_to: "/organizer/billing",
            campaign_id: campaign.id,
          },
          { status: 402 },
        );
      }
      if (
        error instanceof Error &&
        (error.message.includes("额度不足") ||
          error.message.includes("余额不足"))
      ) {
        return Response.json(
          {
            error: error.message,
            code: ErrorCode.VALIDATION_ERROR,
            reason: "INSUFFICIENT_INVITE_CREDIT",
            redirect_to: "/organizer/billing",
            campaign_id: campaign.id,
          },
          { status: 402 },
        );
      }
      throw error;
    }
  }

  return createSuccessResponse({
    campaign_id: campaign.id,
    participant_ids: participantIds,
    created,
    merged,
    sent: parsed.data.send_now !== false,
  });
});
