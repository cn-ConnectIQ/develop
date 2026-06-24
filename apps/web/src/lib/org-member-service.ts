import {
  MemberTier,
  OrgJoinSource,
  prisma,
  type Prisma,
} from "@connectiq/database";
import * as XLSX from "xlsx";

import { JOIN_SOURCE_LABELS } from "@/lib/member-constants";
import { mergeFieldMaps } from "@/lib/marketup-config";
import {
  createContact,
  mapFieldsToMarketup,
  resolveWriteStrategy,
  upsertContact,
} from "@/lib/marketup";
import { getPlatformMarketupConfig } from "@/lib/marketup-sync";
import { syncOrganizationStats } from "@/lib/org-stats";

export { JOIN_SOURCE_LABELS };

const SOURCE_FILTER_MAP: Record<string, OrgJoinSource> = {
  participated: OrgJoinSource.PARTICIPATED_EVENT,
  lead: OrgJoinSource.LEAD_CAPTURED,
  invited: OrgJoinSource.INVITED,
  followed: OrgJoinSource.FOLLOWED,
  qr: OrgJoinSource.QR_SCANNED,
};

export type OrgMemberListItem = {
  id: string;
  userId: string;
  name: string;
  company: string | null;
  jobTitle: string | null;
  phone: string | null;
  joinSource: OrgJoinSource;
  sourceEventId: string | null;
  sourceEventName: string | null;
  eventCount: number;
  lastActiveAt: string | null;
  firstSeenAt: string;
  tier: MemberTier;
  tags: string[];
  notes: string | null;
  isFollowing: boolean;
};

function serializeMember(
  row: Awaited<ReturnType<typeof fetchMemberRows>>[number],
): OrgMemberListItem {
  const profile = row.user.profile;
  return {
    id: row.id,
    userId: row.userId,
    name: row.user.name,
    company: profile?.company ?? null,
    jobTitle: profile?.valueProposition ?? null,
    phone: row.user.phone,
    joinSource: row.joinSource,
    sourceEventId: row.sourceEventId,
    sourceEventName: row.sourceEvent?.name ?? null,
    eventCount: row.eventCount,
    lastActiveAt: row.lastActiveAt?.toISOString() ?? null,
    firstSeenAt: row.firstSeenAt.toISOString(),
    tier: row.tier,
    tags: row.tags,
    notes: row.notes,
    isFollowing: row.isFollowing,
  };
}

async function fetchMemberRows(where: Prisma.OrgMemberWhereInput) {
  return prisma.orgMember.findMany({
    where,
    include: {
      user: {
        select: {
          id: true,
          name: true,
          phone: true,
          profile: {
            select: { company: true, valueProposition: true },
          },
        },
      },
      sourceEvent: { select: { id: true, name: true } },
    },
    orderBy: [{ tier: "asc" }, { lastActiveAt: "desc" }, { createdAt: "desc" }],
  });
}

export async function listOrgMembers(
  orgId: string,
  params: {
    page?: number;
    pageSize?: number;
    search?: string;
    source?: string;
    tier?: string;
    eventId?: string;
    tags?: string[];
  },
) {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 20));

  const and: Prisma.OrgMemberWhereInput[] = [{ orgId }];

  if (params.source && params.source !== "all") {
    const joinSource = SOURCE_FILTER_MAP[params.source];
    if (joinSource) and.push({ joinSource });
  }

  if (params.tier && params.tier !== "all") {
    and.push({ tier: params.tier as MemberTier });
  }

  if (params.eventId && params.eventId !== "all") {
    and.push({ sourceEventId: params.eventId });
  }

  if (params.tags?.length) {
    and.push({ tags: { hasEvery: params.tags } });
  }

  if (params.search?.trim()) {
    const q = params.search.trim();
    and.push({
      OR: [
        { user: { name: { contains: q, mode: "insensitive" } } },
        { user: { phone: { contains: q } } },
        {
          user: {
            profile: {
              is: { company: { contains: q, mode: "insensitive" } },
            },
          },
        },
      ],
    });
  }

  const where: Prisma.OrgMemberWhereInput = { AND: and };

  const [rows, total, orgEvents, tagRows] = await Promise.all([
    prisma.orgMember.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            phone: true,
            profile: {
              select: { company: true, valueProposition: true },
            },
          },
        },
        sourceEvent: { select: { id: true, name: true } },
      },
      orderBy: [
        { tier: "asc" },
        { lastActiveAt: "desc" },
        { createdAt: "desc" },
      ],
    }),
    prisma.orgMember.count({ where }),
    prisma.event.findMany({
      where: { orgId },
      select: { id: true, name: true },
      orderBy: { startDate: "desc" },
    }),
    prisma.orgMember.findMany({
      where: { orgId },
      select: { tags: true },
    }),
  ]);

  const orgTags = [
    ...new Set(tagRows.flatMap((r) => r.tags).filter(Boolean)),
  ].sort();

  return {
    items: rows.map((row) => serializeMember(row)),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
    orgEvents,
    orgTags,
  };
}

export async function getOrgMemberStats(orgId: string) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
  const activeSince = new Date(now.getTime() - 30 * 86_400_000);

  const [
    total,
    newThisMonth,
    newLastMonth,
    active30d,
    followerCount,
    sourceGroups,
    allMembers,
  ] = await Promise.all([
    prisma.orgMember.count({ where: { orgId } }),
    prisma.orgMember.count({
      where: { orgId, createdAt: { gte: monthStart } },
    }),
    prisma.orgMember.count({
      where: {
        orgId,
        createdAt: { gte: lastMonthStart, lte: lastMonthEnd },
      },
    }),
    prisma.orgMember.count({
      where: {
        orgId,
        OR: [
          { lastActiveAt: { gte: activeSince } },
          { createdAt: { gte: activeSince } },
        ],
      },
    }),
    prisma.orgMember.count({
      where: { orgId, isFollowing: true },
    }),
    prisma.orgMember.groupBy({
      by: ["joinSource"],
      where: { orgId },
      _count: { _all: true },
    }),
    prisma.orgMember.findMany({
      where: { orgId },
      select: { createdAt: true },
    }),
  ]);

  const monthOverMonthGrowth =
    newLastMonth === 0
      ? newThisMonth > 0
        ? 100
        : 0
      : Math.round(((newThisMonth - newLastMonth) / newLastMonth) * 100);

  const activeRate =
    total === 0 ? 0 : Math.round((active30d / total) * 100);

  const growthTrend: Array<{ month: string; count: number }> = [];
  for (let i = 5; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const next = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    const count = allMembers.filter(
      (m) => m.createdAt >= d && m.createdAt < next,
    ).length;
    growthTrend.push({
      month: `${d.getMonth() + 1}月`,
      count,
    });
  }

  const sourceDistribution = [
    {
      key: OrgJoinSource.PARTICIPATED_EVENT,
      name: "参加活动",
      color: "#185FA5",
    },
    { key: OrgJoinSource.LEAD_CAPTURED, name: "被采集", color: "#0F6E56" },
    { key: OrgJoinSource.INVITED, name: "邀请激活", color: "#534AB7" },
    { key: OrgJoinSource.FOLLOWED, name: "主动关注", color: "#C9A227" },
    { key: OrgJoinSource.QR_SCANNED, name: "扫码", color: "#EF9F27" },
  ].map((item) => ({
    name: item.name,
    value:
      sourceGroups.find((g) => g.joinSource === item.key)?._count._all ?? 0,
    color: item.color,
  }));

  return {
    total,
    newThisMonth,
    newLastMonth,
    monthOverMonthGrowth,
    active30d,
    activeRate,
    followerCount,
    growthTrend,
    sourceDistribution,
  };
}

export async function getOrgMemberDetail(orgId: string, userId: string) {
  const member = await prisma.orgMember.findUnique({
    where: { orgId_userId: { orgId, userId } },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
          profile: {
            select: {
              company: true,
              valueProposition: true,
              industry: true,
            },
          },
        },
      },
      sourceEvent: { select: { id: true, name: true, type: true, startDate: true } },
    },
  });

  if (!member) return null;

  const user = member.user;
  const orgEvents = await prisma.event.findMany({
    where: { orgId },
    select: { id: true, name: true, type: true, startDate: true },
  });

  const eventIds = orgEvents.map((e) => e.id);
  const participants =
    eventIds.length > 0 && (user.phone || user.email)
      ? await prisma.participant.findMany({
          where: {
            eventId: { in: eventIds },
            OR: [
              ...(user.phone ? [{ phone: user.phone }] : []),
              ...(user.email ? [{ email: user.email }] : []),
            ],
          },
          include: {
            event: { select: { id: true, name: true, type: true, startDate: true } },
            checkIns: { take: 1, orderBy: { checkedInAt: "desc" } },
          },
          orderBy: { createdAt: "desc" },
        })
      : [];

  const tagRows = await prisma.orgMember.findMany({
    where: { orgId },
    select: { tags: true },
  });
  const orgTags = [
    ...new Set(tagRows.flatMap((r) => r.tags).filter(Boolean)),
  ].sort();

  const participationHistory = participants.map((p) => ({
    eventId: p.event.id,
    eventName: p.event.name,
    eventType: p.event.type,
    participatedAt: p.createdAt.toISOString(),
    source: p.checkIns.length > 0 ? "签到" : "报名",
  }));

  const firstParticipation =
    participationHistory.length > 0
      ? participationHistory[participationHistory.length - 1]!.participatedAt
      : member.firstSeenAt.toISOString();

  return {
    member: serializeMember({
      ...member,
      sourceEvent: member.sourceEvent,
    }),
    user: {
      email: user.email,
      industry: user.profile?.industry ?? null,
    },
    participationHistory,
    participationSummary: {
      total: Math.max(member.eventCount, participationHistory.length),
      firstAt: firstParticipation,
    },
    orgTags,
  };
}

export async function updateOrgMember(
  orgId: string,
  userId: string,
  data: { tier?: MemberTier; tags?: string[]; notes?: string | null },
) {
  const existing = await prisma.orgMember.findUnique({
    where: { orgId_userId: { orgId, userId } },
  });
  if (!existing) return null;

  return prisma.orgMember.update({
    where: { orgId_userId: { orgId, userId } },
    data: {
      ...(data.tier !== undefined ? { tier: data.tier } : {}),
      ...(data.tags !== undefined ? { tags: data.tags } : {}),
      ...(data.notes !== undefined ? { notes: data.notes } : {}),
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          phone: true,
          profile: { select: { company: true, valueProposition: true } },
        },
      },
      sourceEvent: { select: { id: true, name: true } },
    },
  });
}

export async function removeOrgMember(orgId: string, userId: string) {
  const existing = await prisma.orgMember.findUnique({
    where: { orgId_userId: { orgId, userId } },
  });
  if (!existing) return false;

  await prisma.orgMember.delete({
    where: { orgId_userId: { orgId, userId } },
  });

  await syncOrganizationStats(orgId);

  return true;
}

export async function exportOrgMembersExcel(
  orgId: string,
  userIds?: string[],
) {
  const where: Prisma.OrgMemberWhereInput = {
    orgId,
    ...(userIds?.length ? { userId: { in: userIds } } : {}),
  };

  const rows = await fetchMemberRows(where);

  const sheetData = rows.map((row) => {
    const item = serializeMember(row);
    return {
      姓名: item.name,
      公司: item.company ?? "",
      职位: item.jobTitle ?? "",
      手机: item.phone ?? "",
      来源: JOIN_SOURCE_LABELS[item.joinSource],
      参与次数: item.eventCount,
      层级: item.tier,
      标签: item.tags.join(", "),
      加入时间: new Date(item.firstSeenAt).toLocaleString("zh-CN"),
      备注: item.notes ?? "",
    };
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(sheetData);
  XLSX.utils.book_append_sheet(wb, ws, "用户池");
  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;

  return buffer;
}

export async function exportMemberToMarketup(orgId: string, userId: string) {
  const detail = await getOrgMemberDetail(orgId, userId);
  if (!detail) return null;

  const { member } = detail;
  if (!member.phone) {
    throw new Error("该用户缺少手机号，无法同步至 MarketUP");
  }

  const platform = await getPlatformMarketupConfig();
  const fieldMap = mergeFieldMaps(platform.fieldMap);
  const config = platform.config;

  const source: Record<string, unknown> = {
    name: member.name,
    phone: member.phone,
    company: member.company ?? "",
    jobTitle: member.jobTitle ?? "",
    notes: member.notes ?? "",
    eventName: member.sourceEventName ?? "ConnectIQ 用户池",
    intentLevel: member.tier,
    joinSource: JOIN_SOURCE_LABELS[member.joinSource] ?? member.joinSource,
    tags: member.tags.join("、"),
  };

  const payload = mapFieldsToMarketup(source, fieldMap);
  const strategy = resolveWriteStrategy(config);
  const contact =
    strategy === "create_only"
      ? await createContact(payload)
      : await upsertContact(member.phone, payload);

  return {
    synced: true,
    userId,
    orgId,
    marketupContactId: contact.id,
    dev: contact.dev ?? false,
    contact: {
      name: member.name,
      phone: member.phone,
      company: member.company,
    },
  };
}

export async function exportMembersToMarketup(orgId: string, userIds: string[]) {
  let synced = 0;
  let skipped = 0;
  const errors: Array<{ userId: string; message: string }> = [];

  for (const userId of userIds) {
    try {
      const result = await exportMemberToMarketup(orgId, userId);
      if (result) synced += 1;
      else skipped += 1;
    } catch (e) {
      errors.push({
        userId,
        message: e instanceof Error ? e.message : "同步失败",
      });
    }
  }

  return { synced, skipped, failed: errors.length, errors };
}

async function requireOrgMember(orgId: string, userId: string) {
  return prisma.orgMember.findUnique({
    where: { orgId_userId: { orgId, userId } },
  });
}

export { requireOrgMember };
