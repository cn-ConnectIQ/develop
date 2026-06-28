import { ActivityType, EventStatus, prisma } from "@connectiq/database";
import { countEventsByType } from "@/lib/event-discover-service";
import { syncOrganizationAccountTotals } from "@/lib/org-account-totals";

export type OrgAccountEventHistoryItem = {
  id: string;
  name: string;
  activityType: string;
  status: "DRAFT" | "PUBLISHED" | "LIVE" | "ENDED";
  role: "organizer" | "exhibitor";
  startDate: string | null;
  endDate: string | null;
  participants: number;
  connections: number;
  leads: number;
  checkIns: number;
  /** 相较上一场主办活动的连接数变化（正=增长） */
  connectionsDelta: number | null;
};

export type OrgExhibitorHistoryItem = {
  boothId: string;
  boothCode: string;
  boothName: string;
  eventId: string;
  eventName: string;
  leads: number;
  status: string;
};

export type OrgRetentionHint = {
  id: string;
  title: string;
  description: string;
  href: string;
};

export type OrgAccountCenter = {
  org: {
    id: string;
    name: string;
    slug: string;
    adminStatus: string;
    isVerified: boolean;
    memberSince: string;
  };
  /** B 端账号级跨活动累计（主办方/展商客户留存，非参会者社交图谱） */
  totals: {
    totalEvents: number;
    totalParticipants: number;
    totalLeads: number;
    totalConnections: number;
    eventsByType: { conference: number; expo: number; exhibition: number };
  };
  /** 主办 + 参展历史 */
  eventHistory: OrgAccountEventHistoryItem[];
  exhibitorHistory: OrgExhibitorHistoryItem[];
  /** 促使 B 端客户「下次还来」的 actionable 引导 */
  retention: {
    lastOrganizerEventId: string | null;
    lastOrganizerEventName: string | null;
    hints: OrgRetentionHint[];
    valueSummary: string;
  };
  dataPolicy: {
    scope: "b2b_account";
    summary: string;
  };
};

function mapEventStatus(status: EventStatus): OrgAccountEventHistoryItem["status"] {
  if (status === EventStatus.ARCHIVED) return "ENDED";
  if (status === EventStatus.LIVE) return "LIVE";
  if (status === EventStatus.PUBLISHED) return "PUBLISHED";
  return "DRAFT";
}

export async function getOrgAccountCenter(orgId: string): Promise<OrgAccountCenter> {
  await syncOrganizationAccountTotals(orgId);

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: {
      id: true,
      name: true,
      slug: true,
      adminStatus: true,
      isVerified: true,
      createdAt: true,
      totalEvents: true,
      totalParticipants: true,
      totalLeads: true,
      totalConnections: true,
    },
  });
  if (!org) {
    throw new Error("组织不存在");
  }

  const [organizedEvents, exhibitorBooths] = await Promise.all([
    prisma.event.findMany({
      where: { orgId },
      orderBy: { startDate: "desc" },
      include: {
        _count: { select: { participants: true, checkIns: true } },
      },
    }),
    prisma.exhibitorBooth.findMany({
      where: { companyOrgId: orgId },
      orderBy: { createdAt: "desc" },
      include: {
        event: { select: { id: true, name: true, startDate: true, endDate: true, status: true, activityType: true } },
        _count: { select: { leads: true } },
      },
    }),
  ]);

  const organizedEventIds = organizedEvents.map((e) => e.id);
  const exhibitorEventIds = exhibitorBooths.map((b) => b.eventId);
  const allEventIds = [...new Set([...organizedEventIds, ...exhibitorEventIds])];

  const [connectionCounts, leadCountsByEvent] = await Promise.all([
    allEventIds.length === 0
      ? Promise.resolve([] as Array<{ eventId: string | null; _count: { _all: number } }>)
      : prisma.businessConnection.groupBy({
          by: ["eventId"],
          where: { eventId: { in: allEventIds } },
          _count: { _all: true },
        }),
    exhibitorBooths.length === 0
      ? Promise.resolve(new Map<string, number>())
      : (async () => {
          const grouped = await prisma.lead.groupBy({
            by: ["boothId"],
            where: { boothId: { in: exhibitorBooths.map((b) => b.id) } },
            _count: { _all: true },
          });
          const boothEventMap = new Map(
            exhibitorBooths.map((b) => [b.id, b.eventId]),
          );
          const map = new Map<string, number>();
          for (const row of grouped) {
            const eventId = boothEventMap.get(row.boothId);
            if (!eventId) continue;
            map.set(eventId, (map.get(eventId) ?? 0) + row._count._all);
          }
          return map;
        })(),
  ]);

  const connectionMap = new Map(
    connectionCounts
      .filter((row) => row.eventId)
      .map((row) => [row.eventId!, row._count._all]),
  );

  const organizerHistoryAsc = [...organizedEvents].sort(
    (a, b) =>
      (a.startDate?.getTime() ?? 0) - (b.startDate?.getTime() ?? 0),
  );
  let prevConnections: number | null = null;
  const organizerDeltaMap = new Map<string, number | null>();
  for (const event of organizerHistoryAsc) {
    const connections = connectionMap.get(event.id) ?? 0;
    organizerDeltaMap.set(
      event.id,
      prevConnections === null ? null : connections - prevConnections,
    );
    prevConnections = connections;
  }

  const eventHistory: OrgAccountEventHistoryItem[] = organizedEvents.map(
    (event) => ({
      id: event.id,
      name: event.name,
      activityType: event.activityType,
      status: mapEventStatus(event.status),
      role: "organizer" as const,
      startDate: event.startDate?.toISOString() ?? null,
      endDate: event.endDate?.toISOString() ?? null,
      participants: event._count.participants,
      connections: connectionMap.get(event.id) ?? 0,
      leads: leadCountsByEvent.get(event.id) ?? 0,
      checkIns: event._count.checkIns,
      connectionsDelta: organizerDeltaMap.get(event.id) ?? null,
    }),
  );

  const exhibitorHistory: OrgExhibitorHistoryItem[] = exhibitorBooths.map(
    (booth) => ({
      boothId: booth.id,
      boothCode: booth.code,
      boothName: booth.name,
      eventId: booth.event.id,
      eventName: booth.event.name,
      leads: booth._count.leads,
      status: booth.status,
    }),
  );

  const eventsForType = organizedEvents.map((e) => ({
    activityType: e.activityType,
  }));

  const lastOrganizer = organizedEvents[0] ?? null;
  const hints = buildRetentionHints(org, lastOrganizer, organizedEvents.length);

  return {
    org: {
      id: org.id,
      name: org.name,
      slug: org.slug,
      adminStatus: org.adminStatus,
      isVerified: org.isVerified,
      memberSince: org.createdAt.toISOString(),
    },
    totals: {
      totalEvents: org.totalEvents,
      totalParticipants: org.totalParticipants,
      totalLeads: org.totalLeads,
      totalConnections: org.totalConnections,
      eventsByType: countEventsByType(eventsForType),
    },
    eventHistory,
    exhibitorHistory,
    retention: {
      lastOrganizerEventId: lastOrganizer?.id ?? null,
      lastOrganizerEventName: lastOrganizer?.name ?? null,
      hints,
      valueSummary: buildValueSummary(org),
    },
    dataPolicy: {
      scope: "b2b_account",
      summary:
        "ConnectIQ「连接完交给微信、不留存」仅适用于参会者（C 端）。主办方/展商账号保留活动历史与跨活动累计数据，用于持续办会与商业转化，不构成参会者之间的持久社交关系。",
    },
  };
}

function buildValueSummary(org: {
  totalEvents: number;
  totalConnections: number;
  totalLeads: number;
}) {
  if (org.totalEvents === 0) {
    return "完成第一场活动后，连接与线索数据将在此持续累积，方便您对比每场 ROI。";
  }
  return `已在 ConnectIQ 积累 ${org.totalEvents} 场活动、${org.totalConnections} 次连接、${org.totalLeads} 条线索——数据随账号保留，下次办会可一键复用配置并对比历史。`;
}

function buildRetentionHints(
  org: { totalConnections: number; totalEvents: number },
  lastEvent: { id: string; name: string; activityType: ActivityType } | null,
  eventCount: number,
): OrgRetentionHint[] {
  const hints: OrgRetentionHint[] = [];

  if (lastEvent) {
    hints.push({
      id: "reuse_settings",
      title: "复用上一场活动配置",
      description: `基于「${lastEvent.name}」的票务、互动与名单设置快速启动下一场`,
      href: `/events/${lastEvent.id}/settings`,
    });
    hints.push({
      id: "compare_reports",
      title: "对比历史活动数据",
      description: "查看连接、签到与互动报告，评估每场提升空间",
      href: `/events/${lastEvent.id}/reports`,
    });
  }

  hints.push({
    id: "new_event",
    title: eventCount > 0 ? "创建下一场活动" : "创建第一场活动",
    description: "独立创建或 Excel 导入，无需绑定百格/MarketUP",
    href: "/events/new",
  });

  if (org.totalConnections > 0) {
    hints.push({
      id: "connections_analytics",
      title: "查看跨活动连接价值",
      description: `累计 ${org.totalConnections} 次连接，分析哪类活动带来最高质量人脉`,
      href: lastEvent
        ? `/events/${lastEvent.id}/connections`
        : "/events",
    });
  }

  hints.push({
    id: "org_profile",
    title: "完善组织信誉页",
    description: "展示历史活动与品牌信息，增强参会者信任",
    href: "/org-profile",
  });

  return hints;
}

/** @deprecated 使用 getOrgAccountCenter；保留移动端 overview 兼容 */
export async function refreshAndGetAccountOverview(orgId: string) {
  await syncOrganizationAccountTotals(orgId);
  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: orgId },
    select: {
      totalEvents: true,
      totalParticipants: true,
      totalLeads: true,
      totalConnections: true,
    },
  });
  const events = await prisma.event.findMany({
    where: { orgId },
    select: { activityType: true },
  });
  return {
    totalEvents: org.totalEvents,
    totalParticipants: org.totalParticipants,
    totalLeads: org.totalLeads,
    totalConnections: org.totalConnections,
    eventsByType: countEventsByType(events),
  };
}
