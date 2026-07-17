import {
  InviteCampaignStatus,
  InviteChannel,
  InviteRecordStatus,
  ParticipantInviteStatus,
  ParticipantSource,
  prisma,
  type Prisma,
} from "@connectiq/database";
import {
  allocateUniqueInviteToken,
  hashInvitePhone,
} from "@/lib/invite/token";
import type {
  ImportContactInput,
  TargetFilterInput,
} from "@/lib/invite/schemas";
import { computeTokenExpiresAt, isInviteTokenTimeExpired } from "@/lib/invite/message";
import { isInviteDestinationBlocked } from "@/lib/invite/blocklist";

export type TargetFilter = TargetFilterInput;

/** 超过此人数走异步 CREATING，避免卡住 HTTP */
export const INVITE_ASYNC_BUILD_THRESHOLD = 80;

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
    ...(filter.tags?.length ? { tags: { hasSome: filter.tags } } : {}),
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

/** Excel 导入联系人 → 按手机/邮箱匹配或新建 Participant */
export async function ensureImportParticipants(
  eventId: string,
  contacts: ImportContactInput[],
): Promise<string[]> {
  const ids: string[] = [];
  for (const row of contacts) {
    const phone = row.phone?.trim() || null;
    const email = row.email?.trim() || null;
    if (!phone && !email) continue;

    const existing = await prisma.participant.findFirst({
      where: {
        eventId,
        OR: [
          ...(phone ? [{ phone }] : []),
          ...(email ? [{ email }] : []),
        ],
      },
      select: { id: true },
    });
    if (existing) {
      ids.push(existing.id);
      continue;
    }

    const created = await prisma.participant.create({
      data: {
        eventId,
        name: row.name?.trim() || phone || email || "导入联系人",
        phone,
        email,
        company: row.company?.trim() || null,
        source: ParticipantSource.IMPORT,
      },
      select: { id: true },
    });
    ids.push(created.id);
  }
  return ids;
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
    const providers = ["wechat", "wechat_mp", "wechat_oa", "wx_mp"];
    if (participant.phone) {
      const byPhone = await prisma.user.findFirst({
        where: { phone: participant.phone },
        include: {
          identities: {
            where: { provider: { in: providers }, verified: true },
            take: 1,
          },
        },
      });
      if (byPhone?.identities[0]?.value) return byPhone.identities[0].value;
    }
    if (participant.email) {
      const byEmail = await prisma.user.findFirst({
        where: { email: participant.email },
        include: {
          identities: {
            where: { provider: { in: providers }, verified: true },
            take: 1,
          },
        },
      });
      if (byEmail?.identities[0]?.value) return byEmail.identities[0].value;
    }
    return null;
  }
  return null;
}

type BuildResult = {
  queued: number;
  skipped: number;
  totalTarget: number;
  isScheduled: boolean;
  building?: boolean;
};

async function buildCampaignRecords(campaignId: string): Promise<BuildResult> {
  const campaign = await prisma.inviteCampaign.findUnique({
    where: { id: campaignId },
    include: {
      event: {
        select: { id: true, endDate: true, orgId: true },
      },
    },
  });
  if (!campaign) throw new Error("CAMPAIGN_NOT_FOUND");

  const filter = parseTargetFilter(campaign.targetFilter);

  if (filter.import_contacts?.length) {
    const importedIds = await ensureImportParticipants(
      campaign.eventId,
      filter.import_contacts,
    );
    filter.participant_ids = [
      ...new Set([...(filter.participant_ids ?? []), ...importedIds]),
    ];
  }

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
          activationToken: await allocateUniqueInviteToken(),
          tokenExpiresAt,
          status: InviteRecordStatus.SKIPPED,
          errorMessage:
            campaign.channel === InviteChannel.WECHAT
              ? "缺少微信 OpenID"
              : "缺少有效联系方式",
        },
      });
      skipped += 1;
      continue;
    }

    const blocked = await isInviteDestinationBlocked({
      destination,
      channel: campaign.channel,
      eventId: campaign.eventId,
      orgId: campaign.event.orgId,
    });
    if (blocked) {
      await prisma.inviteRecord.create({
        data: {
          campaignId,
          participantId: participant.id,
          channel: campaign.channel,
          destination,
          activationToken: await allocateUniqueInviteToken(),
          tokenExpiresAt,
          status: InviteRecordStatus.SKIPPED,
          errorMessage: "已退订或在黑名单中",
        },
      });
      skipped += 1;
      continue;
    }

    const phoneHash =
      campaign.channel === InviteChannel.SMS
        ? hashInvitePhone(destination)
        : participant.phone
          ? hashInvitePhone(participant.phone)
          : null;

    let linkedUserId: string | null = null;
    if (campaign.channel === InviteChannel.SMS || participant.phone) {
      const phone =
        campaign.channel === InviteChannel.SMS
          ? destination
          : participant.phone!;
      const user = await prisma.user.findFirst({
        where: { phone },
        select: { id: true },
      });
      linkedUserId = user?.id ?? null;
    }

    await prisma.inviteRecord.create({
      data: {
        campaignId,
        participantId: participant.id,
        channel: campaign.channel,
        destination,
        activationToken: await allocateUniqueInviteToken(),
        phoneHash,
        userId: linkedUserId,
        tokenExpiresAt,
        status: InviteRecordStatus.PENDING,
      },
    });
    queued += 1;
  }

  const totalTarget = queued + skipped;
  const isScheduled = Boolean(
    campaign.scheduledAt && campaign.scheduledAt.getTime() > Date.now(),
  );

  if (
    queued > 0 &&
    (campaign.channel === InviteChannel.SMS ||
      campaign.channel === InviteChannel.EMAIL) &&
    campaign.event.orgId
  ) {
    const { assertInviteChannelBalance } = await import(
      "@/lib/billing/billing-guards"
    );
    try {
      await assertInviteChannelBalance({
        orgId: campaign.event.orgId,
        channel: campaign.channel,
        count: queued,
      });
    } catch (err) {
      await prisma.inviteRecord.updateMany({
        where: { campaignId, status: InviteRecordStatus.PENDING },
        data: {
          status: InviteRecordStatus.SKIPPED,
          errorMessage: err instanceof Error ? err.message : "额度不足",
        },
      });
      await prisma.inviteCampaign.update({
        where: { id: campaignId },
        data: { status: InviteCampaignStatus.FAILED, totalTarget },
      });
      throw err;
    }
  }

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

  return { queued, skipped, totalTarget, isScheduled };
}

/**
 * 准备发送：小批量同步建明细；大批量先标 CREATING 再异步展开。
 */
export async function prepareCampaignSend(
  campaignId: string,
): Promise<BuildResult> {
  const campaign = await prisma.inviteCampaign.findUnique({
    where: { id: campaignId },
  });
  if (!campaign) throw new Error("CAMPAIGN_NOT_FOUND");

  if (
    campaign.status === InviteCampaignStatus.SENDING ||
    campaign.status === InviteCampaignStatus.SENT ||
    campaign.status === InviteCampaignStatus.CREATING
  ) {
    throw new Error(
      campaign.status === InviteCampaignStatus.CREATING
        ? "CAMPAIGN_BUILDING"
        : "CAMPAIGN_ALREADY_SENT",
    );
  }

  if (campaign.status === InviteCampaignStatus.PAUSED) {
    throw new Error("CAMPAIGN_PAUSED");
  }

  const filter = parseTargetFilter(campaign.targetFilter);
  let estimate = 0;
  if (filter.import_contacts?.length) {
    estimate += filter.import_contacts.length;
  }
  if (filter.participant_ids?.length) {
    estimate = Math.max(estimate, filter.participant_ids.length);
  }
  if (estimate < INVITE_ASYNC_BUILD_THRESHOLD) {
    const quick = await findTargetParticipants(campaign.eventId, filter);
    estimate = Math.max(estimate, quick.length);
  }

  if (estimate >= INVITE_ASYNC_BUILD_THRESHOLD) {
    await prisma.inviteCampaign.update({
      where: { id: campaignId },
      data: {
        status: InviteCampaignStatus.CREATING,
        totalTarget: estimate,
      },
    });

    setImmediate(() => {
      void buildCampaignRecords(campaignId)
        .then(async (result) => {
          if (!result.isScheduled && result.queued > 0) {
            const { triggerInviteProcessing } = await import(
              "@/lib/invite/queue"
            );
            await triggerInviteProcessing(campaignId);
          }
        })
        .catch(async (err) => {
          console.error("[invite] async build failed", campaignId, err);
          await prisma.inviteCampaign
            .update({
              where: { id: campaignId },
              data: { status: InviteCampaignStatus.FAILED },
            })
            .catch(() => undefined);
        });
    });

    return {
      queued: 0,
      skipped: 0,
      totalTarget: estimate,
      isScheduled: Boolean(
        campaign.scheduledAt && campaign.scheduledAt.getTime() > Date.now(),
      ),
      building: true,
    };
  }

  return buildCampaignRecords(campaignId);
}

export async function pauseInviteCampaign(campaignId: string) {
  const campaign = await prisma.inviteCampaign.findUnique({
    where: { id: campaignId },
  });
  if (!campaign) throw new Error("CAMPAIGN_NOT_FOUND");
  if (
    campaign.status !== InviteCampaignStatus.SENDING &&
    campaign.status !== InviteCampaignStatus.SCHEDULED &&
    campaign.status !== InviteCampaignStatus.CREATING
  ) {
    throw new Error("CAMPAIGN_NOT_PAUSABLE");
  }
  return prisma.inviteCampaign.update({
    where: { id: campaignId },
    data: { status: InviteCampaignStatus.PAUSED },
  });
}

export async function resumeInviteCampaign(campaignId: string) {
  const campaign = await prisma.inviteCampaign.findUnique({
    where: { id: campaignId },
  });
  if (!campaign) throw new Error("CAMPAIGN_NOT_FOUND");
  if (campaign.status !== InviteCampaignStatus.PAUSED) {
    throw new Error("CAMPAIGN_NOT_PAUSED");
  }

  const isScheduled = Boolean(
    campaign.scheduledAt && campaign.scheduledAt.getTime() > Date.now(),
  );
  const updated = await prisma.inviteCampaign.update({
    where: { id: campaignId },
    data: {
      status: isScheduled
        ? InviteCampaignStatus.SCHEDULED
        : InviteCampaignStatus.SENDING,
      startedAt: campaign.startedAt ?? new Date(),
    },
  });

  if (!isScheduled) {
    const { triggerInviteProcessing } = await import("@/lib/invite/queue");
    await triggerInviteProcessing(campaignId);
  }
  return updated;
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
  const [sent, delivered, clicked, activated, failed, skipped, pending, sending] =
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
      prisma.inviteRecord.count({
        where: { campaignId, status: InviteRecordStatus.SENDING },
      }),
    ]);

  const inFlight = pending + sending;
  const current = await prisma.inviteCampaign.findUnique({
    where: { id: campaignId },
    select: { status: true },
  });
  const canComplete =
    inFlight === 0 &&
    current &&
    current.status !== InviteCampaignStatus.PAUSED &&
    current.status !== InviteCampaignStatus.DRAFT &&
    current.status !== InviteCampaignStatus.CREATING &&
    current.status !== InviteCampaignStatus.SCHEDULED;

  const campaign = await prisma.inviteCampaign.update({
    where: { id: campaignId },
    data: {
      sentCount: sent,
      deliveredCount: delivered,
      clickedCount: clicked,
      activatedCount: activated,
      failedCount: failed,
      ...(canComplete
        ? {
            status: InviteCampaignStatus.SENT,
            completedAt: new Date(),
          }
        : {}),
    },
  });

  return { campaign, pending: inFlight, skipped };
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
            tags: true,
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

  if (
    campaign.status === InviteCampaignStatus.SENDING ||
    campaign.status === InviteCampaignStatus.CREATING ||
    campaign.status === InviteCampaignStatus.PAUSED
  ) {
    await refreshCampaignStats(campaignId);
    campaign = await getCampaignForEvent(eventId, campaignId);
    if (!campaign) return null;
  }

  const skippedCount = await prisma.inviteRecord.count({
    where: { campaignId, status: InviteRecordStatus.SKIPPED },
  });

  const pendingCount = await prisma.inviteRecord.count({
    where: {
      campaignId,
      status: {
        in: [InviteRecordStatus.PENDING, InviteRecordStatus.SENDING],
      },
    },
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
      firstUsedAt: true,
      status: true,
      tokenExpiresAt: true,
    },
  });

  if (!record) return null;

  const expired = isInviteTokenTimeExpired(record.tokenExpiresAt);
  const now = new Date();
  const isFirstClick = !record.clickedAt && !expired;

  if (!record.firstUsedAt && !expired) {
    await prisma.inviteRecord.update({
      where: { id: record.id },
      data: { firstUsedAt: now },
    });
  }

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
          clickedAt: now,
          firstUsedAt: record.firstUsedAt ?? now,
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

  if (isInviteTokenTimeExpired(record.tokenExpiresAt)) {
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
