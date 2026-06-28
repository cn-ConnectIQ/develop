import { prisma, type Prisma } from "@connectiq/database";

export type TrialSignal =
  | "signup_completed"
  | "event_created"
  | "event_published"
  | "participants_imported"
  | "join_code_generated"
  | "connection_made"
  | "lead_captured";

const SIGNAL_SCORE: Record<TrialSignal, number> = {
  signup_completed: 5,
  event_created: 15,
  event_published: 20,
  participants_imported: 15,
  join_code_generated: 10,
  connection_made: 20,
  lead_captured: 15,
};

type SignalEntry = {
  signal: TrialSignal;
  at: string;
  meta?: Record<string, unknown>;
};

export async function recordTrialSignal(
  orgId: string,
  signal: TrialSignal,
  meta?: Record<string, unknown>,
) {
  const profile = await prisma.organizerTrialProfile.findUnique({
    where: { orgId },
  });
  if (!profile) return;

  const now = new Date();
  const entry: SignalEntry = {
    signal,
    at: now.toISOString(),
    ...(meta ? { meta } : {}),
  };

  const existingSignals = Array.isArray(profile.conversionSignals)
    ? (profile.conversionSignals as SignalEntry[])
    : [];

  const updates: Parameters<typeof prisma.organizerTrialProfile.update>[0]["data"] =
    {
      lastActiveAt: now,
      conversionScore: profile.conversionScore + (SIGNAL_SCORE[signal] ?? 0),
      conversionSignals: [...existingSignals, entry] as Prisma.InputJsonValue,
    };

  switch (signal) {
    case "event_created":
      updates.eventsCreated = { increment: 1 };
      if (!profile.firstEventAt) updates.firstEventAt = now;
      break;
    case "event_published":
      updates.eventsPublished = { increment: 1 };
      if (!profile.firstPublishedAt) updates.firstPublishedAt = now;
      break;
    case "participants_imported":
      if (typeof meta?.count === "number") {
        updates.participantsImported = { increment: meta.count as number };
      } else {
        updates.participantsImported = { increment: 1 };
      }
      if (!profile.firstImportAt) updates.firstImportAt = now;
      break;
    case "connection_made":
      updates.connectionsTotal = { increment: 1 };
      if (!profile.firstConnectionAt) updates.firstConnectionAt = now;
      break;
    case "lead_captured":
      updates.leadsTotal = { increment: 1 };
      break;
    default:
      break;
  }

  await prisma.organizerTrialProfile.update({
    where: { orgId },
    data: updates,
  });
}

export async function syncTrialMetricsFromOrg(orgId: string) {
  const profile = await prisma.organizerTrialProfile.findUnique({
    where: { orgId },
  });
  if (!profile) return null;

  if (!profile) return null;

  const orgEvents = await prisma.event.findMany({
    where: { orgId },
    select: { id: true },
  });
  const eventIds = orgEvents.map((event) => event.id);

  const [eventsCreated, eventsPublished, participantsImported, connectionsTotal, leadsTotal] =
    await Promise.all([
      prisma.event.count({ where: { orgId } }),
      prisma.event.count({
        where: {
          orgId,
          reviewStatus: { in: ["PUBLISHED", "LIVE", "ENDED"] },
        },
      }),
      eventIds.length === 0
        ? Promise.resolve(0)
        : prisma.participant.count({
            where: { eventId: { in: eventIds } },
          }),
      eventIds.length === 0
        ? Promise.resolve(0)
        : prisma.businessConnection.count({
            where: { eventId: { in: eventIds } },
          }),
      eventIds.length === 0
        ? Promise.resolve(0)
        : prisma.lead.count({
            where: { booth: { eventId: { in: eventIds } } },
          }),
    ]);

  return prisma.organizerTrialProfile.update({
    where: { orgId },
    data: {
      eventsCreated,
      eventsPublished,
      participantsImported,
      connectionsTotal,
      leadsTotal,
      lastActiveAt: new Date(),
    },
  });
}

export async function getTrialProfileForOrg(orgId: string) {
  const profile = await prisma.organizerTrialProfile.findUnique({
    where: { orgId },
    include: {
      org: { select: { name: true, adminStatus: true, slug: true } },
    },
  });
  if (!profile) return null;

  await syncTrialMetricsFromOrg(orgId);
  const refreshed = await prisma.organizerTrialProfile.findUnique({
    where: { orgId },
    include: {
      org: { select: { name: true, adminStatus: true, slug: true } },
    },
  });
  if (!refreshed) return null;

  return {
    orgId: refreshed.orgId,
    orgName: refreshed.org.name,
    adminStatus: refreshed.org.adminStatus,
    companyName: refreshed.companyName,
    contactName: refreshed.contactName,
    trialStartedAt: refreshed.trialStartedAt.toISOString(),
    lastActiveAt: refreshed.lastActiveAt.toISOString(),
    eventsCreated: refreshed.eventsCreated,
    eventsPublished: refreshed.eventsPublished,
    participantsImported: refreshed.participantsImported,
    connectionsTotal: refreshed.connectionsTotal,
    leadsTotal: refreshed.leadsTotal,
    conversionScore: refreshed.conversionScore,
    milestones: {
      firstEvent: refreshed.firstEventAt?.toISOString() ?? null,
      firstImport: refreshed.firstImportAt?.toISOString() ?? null,
      firstPublished: refreshed.firstPublishedAt?.toISOString() ?? null,
      firstConnection: refreshed.firstConnectionAt?.toISOString() ?? null,
    },
    onboarding: buildOnboardingSteps(refreshed),
  };
}

function buildOnboardingSteps(profile: {
  firstEventAt: Date | null;
  firstImportAt: Date | null;
  firstPublishedAt: Date | null;
  eventsCreated: number;
  participantsImported: number;
  connectionsTotal: number;
}) {
  return [
    {
      id: "create_event",
      label: "创建第一场活动",
      done: profile.eventsCreated > 0 || !!profile.firstEventAt,
    },
    {
      id: "import_participants",
      label: "导入参会名单（Excel 即可）",
      done: profile.participantsImported > 0 || !!profile.firstImportAt,
    },
    {
      id: "publish_event",
      label: "发布活动并生成活动码",
      done: !!profile.firstPublishedAt,
    },
    {
      id: "experience_onsite",
      label: "现场体验连接与互动",
      done: profile.connectionsTotal > 0,
    },
  ];
}

export async function assertTrialCanPublishEvent(
  orgId: string,
  eventId: string,
) {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { adminStatus: true },
  });
  if (org?.adminStatus !== "TRIAL") return;

  const publishedCount = await prisma.event.count({
    where: {
      orgId,
      id: { not: eventId },
      reviewStatus: { in: ["PUBLISHED", "LIVE"] },
    },
  });

  if (publishedCount >= 1) {
    throw new Error(
      "试用版最多发布 1 场活动。完成体验后可申请正式账号解锁不限场次。",
    );
  }
}

export async function assertTrialCanCreateEvent(orgId: string) {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { adminStatus: true },
  });
  if (org?.adminStatus !== "TRIAL") return;

  const eventCount = await prisma.event.count({ where: { orgId } });
  if (eventCount >= 3) {
    throw new Error(
      "试用版最多创建 3 场活动草稿。发布体验后可申请正式账号。",
    );
  }
}
