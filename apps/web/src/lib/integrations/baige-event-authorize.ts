import {
  ActivityType,
  DataSource,
  EventType,
  PartnerConnectionStatus,
  PartnerSyncTrigger,
  prisma,
  type Prisma,
} from "@connectiq/database";
import { eventLifecycleFields } from "@/lib/event-lifecycle-service";
import { slugify } from "@/lib/event-utils";
import {
  BAIGE_EVENT_ID_KEY,
  BAIGE_PROVIDER,
} from "@/lib/integrations/baige-partner-constants";
import {
  BaigeConnectionError,
  getBaigeConnectionByExternalOrgId,
  getBaigeConnectionByOrgId,
} from "@/lib/integrations/baige-connection-service";
import { syncBaigeParticipants } from "@/lib/integrations/baige-sync";

export type BaigeAuthorizeEventInput = {
  baigeEventId: string;
  name: string;
  startDate?: string | null;
  endDate?: string | null;
  location?: string | null;
  description?: string | null;
  /** 开通后是否立即拉报名，默认 true */
  syncParticipants?: boolean;
};

async function uniqueEventSlug(base: string) {
  const root = slugify(base) || `baige-${Date.now()}`;
  let slug = root;
  for (let i = 0; i < 8; i++) {
    const exists = await prisma.event.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!exists) return slug;
    slug = `${root}-${Math.random().toString(36).slice(2, 6)}`;
  }
  return `${root}-${Date.now()}`;
}

async function findEventByBaigeId(orgId: string, baigeEventId: string) {
  const byRef = await prisma.event.findFirst({
    where: {
      orgId,
      externalRefId: baigeEventId,
      dataSource: DataSource.BAGEVENT,
    },
  });
  if (byRef) return byRef;

  const setting = await prisma.eventSetting.findFirst({
    where: {
      key: BAIGE_EVENT_ID_KEY,
      event: { orgId },
      value: { equals: baigeEventId },
    },
    select: { eventId: true },
  });
  if (setting) {
    return prisma.event.findUnique({ where: { id: setting.eventId } });
  }

  return null;
}

export async function authorizeBaigeEvents(input: {
  orgId: string;
  actorUserId: string;
  events: BaigeAuthorizeEventInput[];
}) {
  const connection = await getBaigeConnectionByOrgId(input.orgId);
  if (!connection || connection.status !== PartnerConnectionStatus.ACTIVE) {
    throw new BaigeConnectionError(
      "请先完成百格授权绑定",
      "NOT_LINKED",
    );
  }

  const results: Array<{
    baigeEventId: string;
    eventId: string;
    created: boolean;
    sync?: { fetched: number; created: number; updated: number; skippedRows: number };
    syncError?: string;
  }> = [];

  for (const item of input.events) {
    const baigeEventId = item.baigeEventId.trim();
    if (!baigeEventId || !item.name.trim()) continue;

    let event = await findEventByBaigeId(input.orgId, baigeEventId);
    let created = false;

    if (!event) {
      const startDate = item.startDate ? new Date(item.startDate) : null;
      const endDate = item.endDate ? new Date(item.endDate) : null;
      event = await prisma.event.create({
        data: {
          name: item.name.trim(),
          slug: await uniqueEventSlug(item.name),
          type: EventType.CONFERENCE,
          activityType: ActivityType.CONFERENCE,
          dataSource: DataSource.BAGEVENT,
          externalRefId: baigeEventId,
          description: item.description?.trim() || null,
          location: item.location?.trim() || null,
          startDate:
            startDate && !Number.isNaN(startDate.getTime()) ? startDate : null,
          endDate: endDate && !Number.isNaN(endDate.getTime()) ? endDate : null,
          organizerId: input.actorUserId,
          orgId: input.orgId,
          ...eventLifecycleFields("DRAFT"),
        },
      });
      created = true;

      await prisma.organization.update({
        where: { id: input.orgId },
        data: { eventCount: { increment: 1 } },
      });
    } else {
      event = await prisma.event.update({
        where: { id: event.id },
        data: {
          dataSource: DataSource.BAGEVENT,
          externalRefId: baigeEventId,
          name: item.name.trim() || event.name,
          ...(item.location?.trim() ? { location: item.location.trim() } : {}),
          ...(item.description?.trim()
            ? { description: item.description.trim() }
            : {}),
        },
      });
    }

    await prisma.eventSetting.upsert({
      where: { eventId_key: { eventId: event.id, key: BAIGE_EVENT_ID_KEY } },
      create: {
        eventId: event.id,
        key: BAIGE_EVENT_ID_KEY,
        value: baigeEventId,
      },
      update: { value: baigeEventId },
    });

    await prisma.externalSync.upsert({
      where: {
        eventId_provider: { eventId: event.id, provider: BAIGE_PROVIDER },
      },
      create: {
        eventId: event.id,
        provider: BAIGE_PROVIDER,
        syncConfig: {
          externalEventId: baigeEventId,
          externalOrgId: connection.externalOrgId,
        } as Prisma.InputJsonValue,
      },
      update: {
        syncConfig: {
          externalEventId: baigeEventId,
          externalOrgId: connection.externalOrgId,
        } as Prisma.InputJsonValue,
      },
    });

    let sync:
      | { fetched: number; created: number; updated: number; skippedRows: number }
      | undefined;
    let syncError: string | undefined;
    if (item.syncParticipants !== false) {
      try {
        const result = await syncBaigeParticipants(
          event.id,
          PartnerSyncTrigger.AUTHORIZE,
        );
        sync = {
          fetched: result.fetched,
          created: result.created,
          updated: result.updated,
          skippedRows: result.skippedRows,
        };
      } catch (err) {
        syncError = err instanceof Error ? err.message : "报名同步失败";
      }
    }

    results.push({
      baigeEventId,
      eventId: event.id,
      created,
      sync,
      syncError,
    });
  }

  return { results };
}

export async function resolveOrgIdForBaigeAuthorize(input: {
  orgId?: string | null;
  externalOrgId?: string | null;
}) {
  if (input.orgId) return input.orgId;
  if (input.externalOrgId) {
    const conn = await getBaigeConnectionByExternalOrgId(input.externalOrgId);
    if (!conn || conn.status !== PartnerConnectionStatus.ACTIVE) {
      throw new BaigeConnectionError("百格组织未绑定玖莅", "NOT_LINKED");
    }
    return conn.orgId;
  }
  throw new BaigeConnectionError("缺少 orgId 或 baigeOrgId", "VALIDATION");
}
