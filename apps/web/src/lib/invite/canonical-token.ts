import {
  InviteCampaignStatus,
  InviteChannel,
  InviteRecordStatus,
  prisma,
} from "@connectiq/database";
import { computeTokenExpiresAt } from "@/lib/invite/message";
import { allocateUniqueInviteToken } from "@/lib/invite/token";

/**
 * 同一活动 + 同一参会者 → 唯一 activationToken（取首次签发记录为权威）。
 */
export async function findCanonicalInviteRecord(
  eventId: string,
  participantId: string,
) {
  return prisma.inviteRecord.findFirst({
    where: {
      participantId,
      campaign: { eventId },
      activationToken: { not: "" },
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      activationToken: true,
      campaignId: true,
      status: true,
    },
  });
}

/** 删掉同活动同参会者的多余邀请记录，只留 keepId */
export async function purgeDuplicateInviteRecords(
  eventId: string,
  participantId: string,
  keepId: string,
): Promise<number> {
  const dups = await prisma.inviteRecord.findMany({
    where: {
      participantId,
      campaign: { eventId },
      id: { not: keepId },
    },
    select: { id: true, campaignId: true },
  });
  if (dups.length === 0) return 0;

  const campaignIds = [...new Set(dups.map((d) => d.campaignId))];
  await prisma.inviteRecord.deleteMany({
    where: { id: { in: dups.map((d) => d.id) } },
  });

  for (const campaignId of campaignIds) {
    const left = await prisma.inviteRecord.count({ where: { campaignId } });
    if (left === 0) {
      const camp = await prisma.inviteCampaign.findUnique({
        where: { id: campaignId },
        select: { status: true },
      });
      if (camp?.status === InviteCampaignStatus.DRAFT) {
        await prisma.inviteCampaign
          .delete({ where: { id: campaignId } })
          .catch(() => undefined);
      }
    }
  }
  return dups.length;
}

export type AttachCanonicalInviteInput = {
  campaignId: string;
  eventId: string;
  participantId: string;
  channel: InviteChannel;
  destination: string;
  phoneHash: string | null;
  userId?: string | null;
  tokenExpiresAt: Date;
  status: InviteRecordStatus;
  errorMessage?: string | null;
};

/**
 * 把「该参会者在本活动的唯一邀请记录」挂到目标场次。
 * 已有 token → 复用；没有 → 新签一个。绝不给同一人同活动发第二枚短码。
 */
export async function attachCanonicalInviteToCampaign(
  input: AttachCanonicalInviteInput,
): Promise<{ recordId: string; activationToken: string; created: boolean }> {
  const canonical = await findCanonicalInviteRecord(
    input.eventId,
    input.participantId,
  );

  if (canonical) {
    await purgeDuplicateInviteRecords(
      input.eventId,
      input.participantId,
      canonical.id,
    );

    const previousCampaignId = canonical.campaignId;
    await prisma.inviteRecord.update({
      where: { id: canonical.id },
      data: {
        campaignId: input.campaignId,
        channel: input.channel,
        destination: input.destination,
        phoneHash: input.phoneHash,
        userId: input.userId ?? null,
        tokenExpiresAt: input.tokenExpiresAt,
        status: input.status,
        errorMessage: input.errorMessage ?? null,
        // activationToken 不变
      },
    });

    if (previousCampaignId !== input.campaignId) {
      const left = await prisma.inviteRecord.count({
        where: { campaignId: previousCampaignId },
      });
      if (left === 0) {
        const camp = await prisma.inviteCampaign.findUnique({
          where: { id: previousCampaignId },
          select: { status: true },
        });
        if (camp?.status === InviteCampaignStatus.DRAFT) {
          await prisma.inviteCampaign
            .delete({ where: { id: previousCampaignId } })
            .catch(() => undefined);
        }
      }
    }

    return {
      recordId: canonical.id,
      activationToken: canonical.activationToken,
      created: false,
    };
  }

  const activationToken = await allocateUniqueInviteToken();
  const created = await prisma.inviteRecord.create({
    data: {
      campaignId: input.campaignId,
      participantId: input.participantId,
      channel: input.channel,
      destination: input.destination,
      activationToken,
      phoneHash: input.phoneHash,
      userId: input.userId ?? null,
      tokenExpiresAt: input.tokenExpiresAt,
      status: input.status,
      errorMessage: input.errorMessage ?? null,
    },
  });

  return {
    recordId: created.id,
    activationToken,
    created: true,
  };
}

export async function resolveEventEndDate(eventId: string): Promise<Date | null> {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { endDate: true },
  });
  return event?.endDate ?? null;
}

export function inviteTokenExpiresAt(eventEndDate: Date | null | undefined) {
  return computeTokenExpiresAt(eventEndDate);
}
