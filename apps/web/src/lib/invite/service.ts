import {
  InviteCampaignStatus,
  InviteChannel,
  InviteRecordStatus,
  ParticipantInviteStatus,
  prisma,
  type Prisma,
} from "@connectiq/database";
import type { TargetFilterInput } from "@/lib/invite/schemas";
import { computeTokenExpiresAt } from "@/lib/invite/message";

export type TargetFilter = TargetFilterInput;

export function parseTargetFilter(value: unknown): TargetFilter {
  if (!value || typeof value !== "object") return { exclude_activated: true };
  return value as TargetFilter;
}

export async function getCampaignForEvent(eventId: string, campaignId: string) {
  return prisma.inviteCampaign.findFirst({
    where: { id: campaignId, eventId },
    include: {
      creator: { select: { id: true, name: true } },
      event: {
        select: {
          id: true,
          name: true,
          location: true,
          startDate: true,
          endDate: true,
          organizer: { select: { id: true, name: true } },
        },
      },
      _count: { select: { records: true } },
    },
  });
}

export async function listCampaigns(eventId: string) {
  return prisma.inviteCampaign.findMany({
    where: { eventId },
    orderBy: { createdAt: "desc" },
    include: {
      creator: { select: { id: true, name: true } },
      _count: { select: { records: true } },
    },
  });
}

export async function findTargetParticipants(
  eventId: string,
  filter: TargetFilter,
) {
  const excludeActivated = filter.exclude_activated !== false;

  const where: Prisma.ParticipantWhereInput = {
    eventId,
    ...(filter.participant_ids?.length
      ? { id: { in: filter.participant_ids } }
      : {}),
    ...(filter.roles?.length ? { role: { in: filter.roles } } : {}),
    ...(filter.invite_status?.length
      ? { inviteStatus: { in: filter.invite_status } }
      : excludeActivated
        ? { inviteStatus: { not: ParticipantInviteStatus.ACTIVATED } }
        : {}),
    ...(filter.ticket_types?.length
      ? {
          registrations: {
            some: { ticketTypeId: { in: filter.ticket_types } },
          },
        }
      : {}),
  };

  if (
    excludeActivated &&
    filter.invite_status?.length &&
    !filter.invite_status.includes(ParticipantInviteStatus.ACTIVATED)
  ) {
    where.inviteStatus = { in: filter.invite_status };
  }

  return prisma.participant.findMany({
    where,
    orderBy: { createdAt: "asc" },
  });
}

export async function resolveDestination(
  participant: { id: string; phone: string | null; email: string | null },
  channel: InviteChannel,
): Promise<string | null> {
  if (channel === InviteChannel.SMS) {
    return participant.phone?.trim() || null;
  }
  if (channel === InviteChannel.EMAIL) {
    return participant.email?.trim() || null;
  }
  if (channel === InviteChannel.WECHAT) {
    if (!participant.phone) return null;
    const user = await prisma.user.findFirst({
      where: { phone: participant.phone },
      include: {
        identities: {
          where: { provider: "wechat", verified: true },
          take: 1,
        },
      },
    });
    return user?.identities[0]?.value ?? null;
  }
  return null;
}

export async function prepareCampaignSend(campaignId: string) {
  const campaign = await prisma.inviteCampaign.findUnique({
    where: { id: campaignId },
    include: {
      event: {
        select: {
          id: true,
          endDate: true,
        },
      },
    },
  });

  if (!campaign) {
    throw new Error("CAMPAIGN_NOT_FOUND");
  }

  if (
    campaign.status === InviteCampaignStatus.SENDING ||
    campaign.status === InviteCampaignStatus.SENT
  ) {
    throw new Error("CAMPAIGN_ALREADY_SENT");
  }

  const filter = parseTargetFilter(campaign.targetFilter);
  const participants = await findTargetParticipants(campaign.eventId, filter);

  const existingRecords = await prisma.inviteRecord.findMany({
    where: { campaignId },
    select: { participantId: true },
  });
  const existingSet = new Set(existingRecords.map((r) => r.participantId));

  const tokenExpiresAt = computeTokenExpiresAt(campaign.event.endDate);
  let queued = 0;
  let skipped = 0;

  for (const participant of participants) {
    if (existingSet.has(participant.id)) continue;

    const destination = await resolveDestination(participant, campaign.channel);

    if (!destination) {
      await prisma.inviteRecord.create({
        data: {
          campaignId,
          participantId: participant.id,
          channel: campaign.channel,
          destination: "",
          tokenExpiresAt,
          status: InviteRecordStatus.SKIPPED,
          errorMessage: "缺少有效联系方式",
        },
      });
      skipped += 1;
      continue;
    }

    await prisma.inviteRecord.create({
      data: {
        campaignId,
        participantId: participant.id,
        channel: campaign.channel,
        destination,
        tokenExpiresAt,
        status: InviteRecordStatus.PENDING,
      },
    });
    queued += 1;
  }

  const totalTarget = queued + skipped;
  const isScheduled =
    campaign.scheduledAt && campaign.scheduledAt.getTime() > Date.now();

  await prisma.inviteCampaign.update({
    where: { id: campaignId },
    data: {
      totalTarget,
      status: isScheduled
        ? InviteCampaignStatus.SCHEDULED
        : InviteCampaignStatus.SENDING,
      startedAt: isScheduled ? undefined : new Date(),
    },
  });

  return { queued, skipped, totalTarget, isScheduled: !!isScheduled };
}

export async function retryFailedRecords(campaignId: string) {
  const result = await prisma.inviteRecord.updateMany({
    where: {
      campaignId,
      status: InviteRecordStatus.FAILED,
    },
    data: {
      status: InviteRecordStatus.PENDING,
      errorMessage: null,
      retryCount: { increment: 1 },
    },
  });

  if (result.count > 0) {
    await prisma.inviteCampaign.update({
      where: { id: campaignId },
      data: { status: InviteCampaignStatus.SENDING },
    });
  }

  return result.count;
}

export async function refreshCampaignStats(campaignId: string) {
  const [sent, delivered, clicked, activated, failed, skipped, pending] =
    await Promise.all([
      prisma.inviteRecord.count({
        where: {
          campaignId,
          status: {
            in: [
              InviteRecordStatus.SENT,
              InviteRecordStatus.DELIVERED,
              InviteRecordStatus.CLICKED,
              InviteRecordStatus.ACTIVATED,
            ],
          },
        },
      }),
      prisma.inviteRecord.count({
        where: {
          campaignId,
          status: {
            in: [
              InviteRecordStatus.DELIVERED,
              InviteRecordStatus.CLICKED,
              InviteRecordStatus.ACTIVATED,
            ],
          },
        },
      }),
      prisma.inviteRecord.count({
        where: {
          campaignId,
          status: {
            in: [InviteRecordStatus.CLICKED, InviteRecordStatus.ACTIVATED],
          },
        },
      }),
      prisma.inviteRecord.count({
        where: { campaignId, status: InviteRecordStatus.ACTIVATED },
      }),
      prisma.inviteRecord.count({
        where: { campaignId, status: InviteRecordStatus.FAILED },
      }),
      prisma.inviteRecord.count({
        where: { campaignId, status: InviteRecordStatus.SKIPPED },
      }),
      prisma.inviteRecord.count({
        where: { campaignId, status: InviteRecordStatus.PENDING },
      }),
    ]);

  const campaign = await prisma.inviteCampaign.update({
    where: { id: campaignId },
    data: {
      sentCount: sent,
      deliveredCount: delivered,
      clickedCount: clicked,
      activatedCount: activated,
      failedCount: failed,
      ...(pending === 0
        ? {
            status: InviteCampaignStatus.SENT,
            completedAt: new Date(),
          }
        : {}),
    },
  });

  return { campaign, pending, skipped };
}

export async function listInviteRecords(
  campaignId: string,
  params: {
    status?: InviteRecordStatus;
    statusGroup?: "success" | "failed" | "skipped";
    page: number;
    pageSize: number;
  },
) {
  const statusFilter = params.statusGroup
    ? {
        success: [
          InviteRecordStatus.SENT,
          InviteRecordStatus.DELIVERED,
          InviteRecordStatus.CLICKED,
          InviteRecordStatus.ACTIVATED,
        ],
        failed: [InviteRecordStatus.FAILED],
        skipped: [InviteRecordStatus.SKIPPED],
      }[params.statusGroup]
    : params.status
      ? [params.status]
      : undefined;

  const where = {
    campaignId,
    ...(statusFilter ? { status: { in: statusFilter } } : {}),
  };

  const [records, total] = await Promise.all([
    prisma.inviteRecord.findMany({
      where,
      skip: (params.page - 1) * params.pageSize,
      take: params.pageSize,
      orderBy: { createdAt: "desc" },
      include: {
        participant: {
          select: {
            id: true,
            name: true,
            company: true,
            phone: true,
            email: true,
            inviteStatus: true,
          },
        },
      },
    }),
    prisma.inviteRecord.count({ where }),
  ]);

  return { records, total };
}

export async function getCampaignProgress(eventId: string, campaignId: string) {
  let campaign = await getCampaignForEvent(eventId, campaignId);
  if (!campaign) return null;

  if (campaign.status === InviteCampaignStatus.SENDING) {
    await refreshCampaignStats(campaignId);
    campaign = await getCampaignForEvent(eventId, campaignId);
    if (!campaign) return null;
  }

  const skippedCount = await prisma.inviteRecord.count({
    where: { campaignId, status: InviteRecordStatus.SKIPPED },
  });

  const pendingCount = await prisma.inviteRecord.count({
    where: { campaignId, status: InviteRecordStatus.PENDING },
  });

  let estimatedCompletion: Date | null = null;
  if (
    campaign.status === InviteCampaignStatus.SENDING &&
    campaign.startedAt &&
    campaign.sentCount > 0 &&
    campaign.totalTarget > campaign.sentCount
  ) {
    const elapsedMs = Date.now() - campaign.startedAt.getTime();
    if (elapsedMs > 0) {
      const ratePerMs = campaign.sentCount / elapsedMs;
      const remaining = campaign.totalTarget - campaign.sentCount;
      estimatedCompletion = new Date(Date.now() + remaining / ratePerMs);
    }
  }

  return {
    id: campaign.id,
    name: campaign.name,
    channel: campaign.channel,
    status: campaign.status,
    totalTarget: campaign.totalTarget,
    sentCount: campaign.sentCount,
    deliveredCount: campaign.deliveredCount,
    clickedCount: campaign.clickedCount,
    activatedCount: campaign.activatedCount,
    failedCount: campaign.failedCount,
    skippedCount,
    pendingCount,
    createdAt: campaign.createdAt,
    startedAt: campaign.startedAt,
    completedAt: campaign.completedAt,
    scheduledAt: campaign.scheduledAt,
    customMessage: campaign.customMessage,
    subject: campaign.subject,
    templateId: campaign.templateId,
    targetFilter: campaign.targetFilter,
    estimatedCompletion,
  };
}

export type JoinPageEventInfo = {
  id: string;
  name: string;
  location: string | null;
  startDate: string | null;
  endDate: string | null;
  coverUrl: string | null;
};

export type JoinPageResult =
  | { kind: "invalid" }
  | {
      kind: "activated";
      token: string;
      event: JoinPageEventInfo;
      organizerName: string;
      participantName: string;
      downloadUrl: string;
      deepLink: string;
    }
  | {
      kind: "valid";
      token: string;
      event: JoinPageEventInfo;
      organizerName: string;
      participantName: string;
      tokenExpiresAt: string;
      downloadUrl: string;
      deepLink: string;
    };

const APP_DOWNLOAD_URL =
  process.env.NEXT_PUBLIC_APP_DOWNLOAD_URL ??
  "https://app.connectiq.cn/download";

function buildDeepLink(token: string, eventId: string) {
  const scheme = process.env.NEXT_PUBLIC_APP_DEEP_LINK_SCHEME ?? "connectiq";
  return `${scheme}://join?token=${encodeURIComponent(token)}&event=${encodeURIComponent(eventId)}`;
}

async function fetchEventCoverUrl(eventId: string): Promise<string | null> {
  const setting = await prisma.eventSetting.findUnique({
    where: { eventId_key: { eventId, key: "cover_url" } },
    select: { value: true },
  });
  if (!setting?.value || typeof setting.value !== "string") return null;
  return setting.value;
}

export async function recordInviteClick(token: string) {
  const record = await prisma.inviteRecord.findUnique({
    where: { activationToken: token },
    select: {
      id: true,
      campaignId: true,
      participantId: true,
      clickedAt: true,
      status: true,
      tokenExpiresAt: true,
    },
  });

  if (!record) return null;

  const expired = record.tokenExpiresAt.getTime() < Date.now();
  const isFirstClick = !record.clickedAt && !expired;

  if (
    isFirstClick &&
    record.status !== InviteRecordStatus.ACTIVATED
  ) {
    const nextStatus =
      record.status === InviteRecordStatus.SENT ||
      record.status === InviteRecordStatus.DELIVERED ||
      record.status === InviteRecordStatus.PENDING
        ? InviteRecordStatus.CLICKED
        : record.status;

    await prisma.$transaction([
      prisma.inviteRecord.update({
        where: { id: record.id },
        data: {
          status: nextStatus,
          clickedAt: new Date(),
        },
      }),
      prisma.participant.updateMany({
        where: {
          id: record.participantId,
          inviteStatus: {
            in: [
              ParticipantInviteStatus.NOT_INVITED,
              ParticipantInviteStatus.INVITED,
            ],
          },
        },
        data: { inviteStatus: ParticipantInviteStatus.CLICKED },
      }),
      prisma.inviteCampaign.update({
        where: { id: record.campaignId },
        data: { clickedCount: { increment: 1 } },
      }),
    ]);
  }

  return record;
}

export async function resolveJoinPageData(
  token: string | undefined,
  eventIdParam?: string,
  options?: { recordClick?: boolean },
): Promise<JoinPageResult> {
  if (!token?.trim()) {
    return { kind: "invalid" };
  }

  if (options?.recordClick !== false) {
    await recordInviteClick(token);
  }

  const record = await prisma.inviteRecord.findUnique({
    where: { activationToken: token },
    include: {
      participant: { select: { id: true, name: true, inviteStatus: true } },
      campaign: {
        include: {
          event: {
            select: {
              id: true,
              name: true,
              location: true,
              startDate: true,
              endDate: true,
              organizer: { select: { name: true } },
            },
          },
        },
      },
    },
  });

  if (!record) {
    return { kind: "invalid" };
  }

  const expired = record.tokenExpiresAt.getTime() < Date.now();
  if (expired) {
    return { kind: "invalid" };
  }

  if (eventIdParam && record.campaign.event.id !== eventIdParam) {
    return { kind: "invalid" };
  }

  const coverUrl = await fetchEventCoverUrl(record.campaign.event.id);
  const event: JoinPageEventInfo = {
    id: record.campaign.event.id,
    name: record.campaign.event.name,
    location: record.campaign.event.location,
    startDate: record.campaign.event.startDate?.toISOString() ?? null,
    endDate: record.campaign.event.endDate?.toISOString() ?? null,
    coverUrl,
  };

  const downloadUrl = `${APP_DOWNLOAD_URL}?token=${encodeURIComponent(token)}`;
  const deepLink = buildDeepLink(token, event.id);
  const organizerName = record.campaign.event.organizer.name;
  const participantName = record.participant.name;

  const isActivated =
    record.status === InviteRecordStatus.ACTIVATED ||
    record.participant.inviteStatus === ParticipantInviteStatus.ACTIVATED;

  if (isActivated) {
    return {
      kind: "activated",
      token,
      event,
      organizerName,
      participantName,
      downloadUrl,
      deepLink,
    };
  }

  return {
    kind: "valid",
    token,
    event,
    organizerName,
    participantName,
    tokenExpiresAt: record.tokenExpiresAt.toISOString(),
    downloadUrl,
    deepLink,
  };
}
