import {
  InviteCampaignStatus,
  InviteChannel,
  InviteRecordStatus,
  prisma,
} from "@connectiq/database";
import {
  FIXED_PARTICIPANT_INVITE_SUBJECT,
  FIXED_PARTICIPANT_INVITE_TEMPLATE,
  computeTokenExpiresAt,
} from "@/lib/invite/message";
import { buildInviteShortUrl } from "@/lib/invite/invite-url";
import {
  allocateUniqueInviteToken,
  hashInvitePhone,
} from "@/lib/invite/token";

export type InvitePreviewTokenResult = {
  activationToken: string;
  previewLink: string;
  hasExistingToken: true;
  created: boolean;
};

/**
 * 邀请弹窗预览：保证该参会者在本活动下已有真实 activationToken。
 * - 已有记录 → 返回最新短链
 * - 没有 → 签发 DRAFT 场次 + PENDING 记录（不真正发送）
 * 确认发送时会把 DRAFT 预览记录迁入发送场次，保证短信里的短码与预览一致。
 */
export async function ensureParticipantInvitePreviewToken(input: {
  eventId: string;
  participantId: string;
  createdBy?: string | null;
}): Promise<InvitePreviewTokenResult> {
  const participant = await prisma.participant.findFirst({
    where: { id: input.participantId, eventId: input.eventId },
    select: { id: true, name: true, phone: true, email: true },
  });
  if (!participant) {
    throw new Error("PARTICIPANT_NOT_FOUND");
  }

  const existing = await prisma.inviteRecord.findFirst({
    where: {
      participantId: participant.id,
      campaign: { eventId: input.eventId },
      activationToken: { not: "" },
    },
    orderBy: { createdAt: "desc" },
    select: { activationToken: true },
  });
  if (existing?.activationToken) {
    return {
      activationToken: existing.activationToken,
      previewLink: buildInviteShortUrl(existing.activationToken),
      hasExistingToken: true,
      created: false,
    };
  }

  const event = await prisma.event.findUnique({
    where: { id: input.eventId },
    select: { endDate: true },
  });
  if (!event) {
    throw new Error("EVENT_NOT_FOUND");
  }

  const channel = participant.phone?.trim()
    ? InviteChannel.SMS
    : participant.email?.trim()
      ? InviteChannel.EMAIL
      : InviteChannel.SMS;
  const destination =
    channel === InviteChannel.SMS
      ? participant.phone?.trim() || ""
      : participant.email?.trim() || "";

  const campaign = await prisma.inviteCampaign.create({
    data: {
      eventId: input.eventId,
      createdBy: input.createdBy ?? null,
      name: `预览签发·${participant.name}`,
      channel,
      status: InviteCampaignStatus.DRAFT,
      customMessage: FIXED_PARTICIPANT_INVITE_TEMPLATE,
      subject: FIXED_PARTICIPANT_INVITE_SUBJECT,
      targetFilter: {
        participant_ids: [participant.id],
        preview_only: true,
      },
      totalTarget: 1,
    },
  });

  const activationToken = await allocateUniqueInviteToken();
  const phoneHash = participant.phone?.trim()
    ? hashInvitePhone(participant.phone.trim())
    : null;

  await prisma.inviteRecord.create({
    data: {
      campaignId: campaign.id,
      participantId: participant.id,
      channel,
      destination,
      activationToken,
      phoneHash,
      tokenExpiresAt: computeTokenExpiresAt(event.endDate),
      status: InviteRecordStatus.PENDING,
    },
  });

  return {
    activationToken,
    previewLink: buildInviteShortUrl(activationToken),
    hasExistingToken: true,
    created: true,
  };
}
