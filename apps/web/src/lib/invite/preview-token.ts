import {
  InviteCampaignStatus,
  InviteChannel,
  InviteRecordStatus,
  prisma,
} from "@connectiq/database";
import {
  findCanonicalInviteRecord,
  purgeDuplicateInviteRecords,
  inviteTokenExpiresAt,
} from "@/lib/invite/canonical-token";
import {
  FIXED_PARTICIPANT_INVITE_SUBJECT,
  FIXED_PARTICIPANT_INVITE_TEMPLATE,
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
 * 邀请弹窗预览：同一活动同一参会者只有一枚 activationToken。
 * 已有则展示；没有则签发一枚（DRAFT，不发送）。发送/重发均复用此短码。
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

  const existing = await findCanonicalInviteRecord(
    input.eventId,
    participant.id,
  );
  if (existing?.activationToken) {
    await purgeDuplicateInviteRecords(
      input.eventId,
      participant.id,
      existing.id,
    );
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
      tokenExpiresAt: inviteTokenExpiresAt(event.endDate),
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
