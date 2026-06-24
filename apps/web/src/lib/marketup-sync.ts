import { prisma, type Prisma } from "@connectiq/database";
import {
  getExternalSync,
  parseFieldMap,
  parseSyncConfig,
} from "@/lib/external-sync";
import {
  DEFAULT_CUSTOM_FIELD_MAP,
  MARKETUP_PROVIDER,
  mergeFieldMaps,
  parsePlatformFieldMap,
  parsePlatformSyncConfig,
} from "@/lib/marketup-config";
import {
  createContact,
  createLead,
  mapFieldsToMarketup,
  resolveWriteStrategy,
  triggerAutomation,
  upsertContact,
} from "@/lib/marketup";
import type { MarketupSyncConfig } from "@/types/booth";
import { classifyLeadGrade } from "@/lib/booth-map";

function inferIntentLevel(lead: {
  intentTags: Array<{ intentTag: { label: string } }>;
}): string {
  const label = lead.intentTags[0]?.intentTag.label ?? "";
  return classifyLeadGrade(label);
}

export async function getPlatformMarketupConfig() {
  const row = await prisma.platformIntegration.findUnique({
    where: { provider: MARKETUP_PROVIDER },
  });

  return {
    fieldMap: parsePlatformFieldMap(row?.fieldMap),
    config: parsePlatformSyncConfig(row?.syncConfig),
  };
}

export async function savePlatformMarketupConfig(data: {
  fieldMap?: Record<string, string>;
  config?: MarketupSyncConfig;
}) {
  const existing = await getPlatformMarketupConfig();

  return prisma.platformIntegration.upsert({
    where: { provider: MARKETUP_PROVIDER },
    create: {
      provider: MARKETUP_PROVIDER,
      fieldMap: (data.fieldMap ?? existing.fieldMap) as Prisma.InputJsonValue,
      syncConfig: (data.config ??
        existing.config) as Prisma.InputJsonValue,
    },
    update: {
      ...(data.fieldMap !== undefined && {
        fieldMap: data.fieldMap as Prisma.InputJsonValue,
      }),
      ...(data.config !== undefined && {
        syncConfig: data.config as Prisma.InputJsonValue,
      }),
    },
  });
}

async function resolveSyncConfig(eventId: string): Promise<{
  fieldMap: Record<string, string>;
  config: MarketupSyncConfig;
}> {
  const [platform, eventSync] = await Promise.all([
    getPlatformMarketupConfig(),
    getExternalSync(eventId).catch(() => null),
  ]);

  const eventFieldMap = eventSync ? parseFieldMap(eventSync.fieldMap) : {};
  const eventConfig = eventSync
    ? parseSyncConfig(eventSync.syncConfig)
    : platform.config;

  const customMap = {
    ...DEFAULT_CUSTOM_FIELD_MAP,
    ...platform.fieldMap,
    ...eventFieldMap,
  };

  return {
    fieldMap: mergeFieldMaps(customMap),
    config: eventConfig,
  };
}

async function enqueueSyncFailure(
  leadId: string,
  eventId: string,
  error: unknown,
) {
  const message =
    error instanceof Error ? error.message : "MarketUP 同步失败";

  await prisma.lead.update({
    where: { id: leadId },
    data: {
      crmSyncStatus: "FAILED",
      crmSyncError: message,
    },
  });

  const existing = await prisma.crmSyncJob.findFirst({
    where: { leadId, status: { in: ["PENDING", "FAILED"] } },
    orderBy: { createdAt: "desc" },
  });

  if (existing) {
    await prisma.crmSyncJob.update({
      where: { id: existing.id },
      data: {
        status: "FAILED",
        errorMessage: message,
        attempts: { increment: 1 },
        lastAttemptAt: new Date(),
      },
    });
    return existing.id;
  }

  const job = await prisma.crmSyncJob.create({
    data: {
      leadId,
      eventId,
      status: "FAILED",
      errorMessage: message,
      attempts: 1,
      lastAttemptAt: new Date(),
    },
  });
  return job.id;
}

export async function scheduleLeadMarketupSync(leadId: string, eventId: string) {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { crmSyncStatus: true },
  });
  if (lead?.crmSyncStatus === "SYNCED") {
    return { synced: true, leadId };
  }

  const existing = await prisma.crmSyncJob.findFirst({
    where: { leadId, status: { in: ["PENDING", "FAILED"] } },
    orderBy: { createdAt: "desc" },
  });

  if (!existing) {
    await prisma.crmSyncJob.create({
      data: { leadId, eventId, status: "PENDING" },
    });
  } else if (existing.status === "FAILED") {
    await prisma.crmSyncJob.update({
      where: { id: existing.id },
      data: { status: "PENDING", lastAttemptAt: new Date() },
    });
  }

  await prisma.lead.update({
    where: { id: leadId },
    data: { crmSyncStatus: "PENDING", crmSyncError: null },
  });

  try {
    return await syncLeadToMarketup(leadId);
  } catch {
    return { synced: false, leadId };
  }
}

export async function getEventMarketupSyncStats(eventId: string) {
  const [synced, pending, failed, recentLeads, failures] = await Promise.all([
    prisma.lead.count({
      where: { booth: { eventId }, crmSyncStatus: "SYNCED" },
    }),
    prisma.lead.count({
      where: { booth: { eventId }, crmSyncStatus: "PENDING" },
    }),
    prisma.lead.count({
      where: { booth: { eventId }, crmSyncStatus: "FAILED" },
    }),
    prisma.lead.findMany({
      where: { booth: { eventId } },
      orderBy: { createdAt: "desc" },
      take: 15,
      select: {
        id: true,
        crmSyncStatus: true,
        crmSyncError: true,
        crmSyncedAt: true,
        createdAt: true,
        marketupLeadId: true,
        participant: { select: { name: true } },
        booth: { select: { code: true } },
      },
    }),
    prisma.crmSyncJob.findMany({
      where: { eventId, status: "FAILED" },
      orderBy: { lastAttemptAt: "desc" },
      take: 10,
      include: {
        lead: {
          include: {
            participant: { select: { name: true } },
            booth: { select: { code: true } },
          },
        },
      },
    }),
  ]);

  return {
    synced,
    pending,
    failed,
    total: synced + pending + failed,
    recentLeads: recentLeads.map((lead) => ({
      id: lead.id,
      participantName: lead.participant.name,
      boothCode: lead.booth.code,
      status: lead.crmSyncStatus,
      error: lead.crmSyncError,
      syncedAt: lead.crmSyncedAt?.toISOString() ?? null,
      createdAt: lead.createdAt.toISOString(),
      marketupLeadId: lead.marketupLeadId,
    })),
    failures: failures.map((job) => ({
      id: job.id,
      leadId: job.leadId,
      participantName: job.lead.participant.name,
      boothCode: job.lead.booth.code,
      errorMessage: job.errorMessage ?? "未知错误",
      attemptedAt: (job.lastAttemptAt ?? job.createdAt).toISOString(),
    })),
  };
}

export async function syncLeadToMarketup(leadId: string) {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: {
      participant: true,
      intentTags: { include: { intentTag: true } },
      booth: { include: { event: true } },
    },
  });

  if (!lead) throw new Error("线索不存在");
  if (!lead.participant.phone) throw new Error("参会者缺少手机号");

  const { fieldMap, config } = await resolveSyncConfig(lead.booth.eventId);

  const source = {
    name: lead.participant.name,
    phone: lead.participant.phone,
    company: lead.participant.company ?? "",
    jobTitle: lead.participant.jobTitle ?? "",
    notes: lead.notes ?? "",
    intentLevel: inferIntentLevel(lead),
    eventName: lead.booth.event.name,
  };

  const payload = mapFieldsToMarketup(source, fieldMap);

  try {
    const strategy = resolveWriteStrategy(config);
    const contact =
      strategy === "create_only"
        ? await createContact(payload)
        : await upsertContact(lead.participant.phone, payload);

    const leadPayload = mapFieldsToMarketup(
      {
        eventName: lead.booth.event.name,
        notes: lead.notes ?? "",
        intentLevel: source.intentLevel,
      },
      fieldMap,
    );
    leadPayload.展位号 = lead.booth.code;

    const marketupLead = await createLead(contact.id, leadPayload);

    if (config.triggers.welcomeEmail) {
      await triggerAutomation("welcome_email", {
        contactId: contact.id,
        phone: lead.participant.phone,
      });
    }

    if (config.triggers.assignSalesOnA && source.intentLevel === "A") {
      await triggerAutomation("assign_sales_a", {
        contactId: contact.id,
        leadId: marketupLead.id,
      });
    }

    await prisma.lead.update({
      where: { id: leadId },
      data: {
        crmSyncStatus: "SYNCED",
        crmSyncError: null,
        crmSyncedAt: new Date(),
        marketupContactId: contact.id,
        marketupLeadId: marketupLead.id,
      },
    });

    await prisma.crmSyncJob.updateMany({
      where: { leadId, status: { in: ["PENDING", "FAILED"] } },
      data: { status: "SYNCED" },
    });

    return { contactId: contact.id, leadId: marketupLead.id, synced: true };
  } catch (error) {
    await enqueueSyncFailure(leadId, lead.booth.eventId, error);
    throw error;
  }
}

export async function retryMarketupSync(jobId?: string, leadId?: string) {
  if (leadId) {
    return syncLeadToMarketup(leadId);
  }

  if (!jobId) throw new Error("缺少 jobId 或 leadId");

  const job = await prisma.crmSyncJob.findUnique({ where: { id: jobId } });
  if (!job) throw new Error("重试任务不存在");

  await prisma.crmSyncJob.update({
    where: { id: jobId },
    data: { status: "PENDING", lastAttemptAt: new Date() },
  });

  return syncLeadToMarketup(job.leadId);
}

export async function getMarketupSyncStats() {
  const [contacts, opportunities, failed, failures] = await Promise.all([
    prisma.lead.count({ where: { crmSyncStatus: "SYNCED" } }),
    prisma.lead.count({
      where: { crmSyncStatus: "SYNCED", marketupLeadId: { not: null } },
    }),
    prisma.lead.count({ where: { crmSyncStatus: "FAILED" } }),
    prisma.crmSyncJob.findMany({
      where: { status: "FAILED" },
      orderBy: { lastAttemptAt: "desc" },
      take: 10,
      include: {
        lead: {
          include: { participant: { select: { name: true } } },
        },
      },
    }),
  ]);

  return {
    contacts,
    opportunities,
    failed,
    failures: failures.map((job) => ({
      id: job.id,
      leadId: job.leadId,
      participantName: job.lead.participant.name,
      errorMessage: job.errorMessage ?? "未知错误",
      attemptedAt: job.lastAttemptAt ?? job.createdAt,
    })),
  };
}

export async function triggerEventEndNurture(eventId: string) {
  const { config } = await resolveSyncConfig(eventId);
  if (!config.triggers.nurtureOnEnd) return { triggered: false };

  await triggerAutomation("nurture_end", { eventId });
  return { triggered: true };
}
