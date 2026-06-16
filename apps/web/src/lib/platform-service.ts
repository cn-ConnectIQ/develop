import { prisma } from "@connectiq/database";
import type {
  ConnectionSource,
  PointsReason,
  RegistrationSource,
  UserAccountStatus,
} from "@connectiq/database";

const SOURCE_LABELS: Record<ConnectionSource, string> = {
  SCAN: "扫码",
  AI_RECOMMEND: "AI 推荐",
  SPEED_NETWORKING: "SN",
  REFERRAL: "引荐",
};

const REG_SOURCE_LABELS: Record<RegistrationSource, string> = {
  EMAIL: "邮箱",
  PHONE: "手机",
  WECHAT: "微信",
  IMPORT: "导入",
};

const STATUS_TAB_MAP: Record<string, UserAccountStatus> = {
  SHADOW: "SHADOW",
  活跃: "ACTIVE",
  完整: "COMPLETE",
  封禁: "BANNED",
};

const REASON_LABELS: Record<PointsReason, string> = {
  CHECKIN: "签到奖励",
  CONNECTION: "建立连接",
  INTERACTION: "互动参与",
  PROFILE: "完善资料",
  REFERRAL: "邀请好友",
  REDEMPTION: "权益兑换",
  ADJUSTMENT: "手动调整",
};

function maskPhone(phone: string | null) {
  if (!phone) return null;
  return phone.replace(/(\d{3})\d{4}(\d{4})/, "$1****$2");
}

function parseTags(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((t) => typeof t === "string");
  return [];
}

export async function fetchPlatformOverviewStats() {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [
    totalUsers,
    monthUsers,
    endUsers,
    accountAdmins,
    pendingApplications,
    totalEvents,
    liveEvents,
    pendingEventReviews,
    totalConnections,
    monthConnections,
    totalOrgs,
    approvedOrgs,
    pendingOrgs,
    pendingAppPreview,
    pendingEventPreview,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { createdAt: { gte: monthStart } } }),
    prisma.user.count({ where: { userType: "END_USER" } }),
    prisma.user.count({ where: { userType: "ACCOUNT_ADMIN" } }),
    prisma.organizerApplication.count({
      where: { status: "PENDING" },
    }),
    prisma.event.count(),
    prisma.event.count({
      where: { status: { in: ["LIVE", "PUBLISHED"] } },
    }),
    prisma.eventReview.count({
      where: { status: "PENDING_REVIEW" },
    }),
    prisma.businessConnection.count({
      where: { status: { not: "DISCONNECTED" } },
    }),
    prisma.businessConnection.count({
      where: { createdAt: { gte: monthStart }, status: { not: "DISCONNECTED" } },
    }),
    prisma.organization.count(),
    prisma.organization.count({
      where: { adminStatus: "APPROVED" },
    }),
    prisma.organization.count({
      where: { adminStatus: "PENDING_REVIEW" },
    }),
    prisma.organizerApplication.findMany({
      where: { status: "PENDING" },
      orderBy: { submittedAt: "desc" },
      take: 3,
      select: {
        orgName: true,
        accountType: true,
        submittedAt: true,
      },
    }),
    prisma.eventReview.findMany({
      where: { status: "PENDING_REVIEW" },
      orderBy: { submittedAt: "desc" },
      take: 3,
      include: {
        event: { select: { name: true, type: true, startDate: true } },
      },
    }),
  ]);

  const growth = await buildGrowthSeries(6);

  return {
    users: {
      total: totalUsers,
      thisMonth: monthUsers,
      end_users: endUsers,
      account_admins: accountAdmins,
      pending_applications: pendingApplications,
    },
    events: {
      total: totalEvents,
      live: liveEvents,
      pending_review: pendingEventReviews,
    },
    connections: {
      total: totalConnections,
      thisMonth: monthConnections,
    },
    organizations: {
      total: totalOrgs,
      approved: approvedOrgs,
      pending: pendingOrgs,
    },
    pendingTotal: pendingApplications + pendingEventReviews,
    pendingApplicationsPreview: pendingAppPreview.map((item) => ({
      orgName: item.orgName,
      accountType: item.accountType,
      submittedAt: item.submittedAt.toISOString(),
    })),
    pendingEventsPreview: pendingEventPreview.map((item) => ({
      eventName: item.event.name,
      eventType: item.event.type,
      startDate: item.event.startDate?.toISOString() ?? null,
      submittedAt: item.submittedAt.toISOString(),
    })),
    growth,
  };
}

async function buildGrowthSeries(months: number) {
  const now = new Date();
  const series: Array<{ month: string; users: number; organizations: number }> =
    [];

  for (let i = months - 1; i >= 0; i -= 1) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);

    const [users, organizations] = await Promise.all([
      prisma.user.count({ where: { createdAt: { lt: end } } }),
      prisma.organization.count({ where: { createdAt: { lt: end } } }),
    ]);

    series.push({
      month: `${start.getMonth() + 1}月`,
      users,
      organizations,
    });
  }

  return series;
}

export async function fetchPlatformUsers(params: {
  search?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}) {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 20;

  const statusFilter =
    params.status && params.status !== "全部"
      ? STATUS_TAB_MAP[params.status]
      : undefined;

  const where = {
    ...(params.search
      ? {
          OR: [
            { name: { contains: params.search, mode: "insensitive" as const } },
            { email: { contains: params.search, mode: "insensitive" as const } },
            { phone: { contains: params.search } },
          ],
        }
      : {}),
    ...(statusFilter
      ? { profile: { accountStatus: statusFilter } }
      : {}),
  };

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: "desc" },
      include: {
        profile: true,
        roleAssignments: true,
        _count: {
          select: {
            connectionsAsA: true,
            connectionsAsB: true,
          },
        },
      },
    }),
    prisma.user.count({ where }),
  ]);

  return {
    users: users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      phone: maskPhone(u.phone),
      company: u.profile?.company ?? "—",
      source: u.profile
        ? REG_SOURCE_LABELS[u.profile.registrationSource]
        : u.phone
          ? "手机"
          : "邮箱",
      status: u.profile?.accountStatus ?? "ACTIVE",
      connections: u._count.connectionsAsA + u._count.connectionsAsB,
      createdAt: u.createdAt.toISOString(),
      roles: u.roleAssignments.map((r) => ({
        id: r.id,
        role: r.role,
        entityId: r.entityId,
      })),
    })),
    total,
    page,
    pageSize,
  };
}

export async function fetchPlatformUserDetail(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      profile: true,
      identities: true,
      roleAssignments: true,
      organizedEvents: {
        take: 10,
        select: { id: true, name: true, startDate: true, type: true },
      },
      pointsLedger: { orderBy: { createdAt: "desc" }, take: 30 },
      feedItems: { orderBy: { createdAt: "desc" }, take: 20 },
      connectionsAsA: { take: 50 },
      connectionsAsB: { take: 50 },
    },
  });

  if (!user) return null;

  const allConnections = [...user.connectionsAsA, ...user.connectionsAsB];
  const depthBuckets = [0, 0, 0, 0, 0];
  for (const c of allConnections) {
    const idx = Math.min(Math.max(c.depth, 1), 5) - 1;
    depthBuckets[idx] += 1;
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    company: user.profile?.company ?? "—",
    tags: parseTags(user.profile?.intentTags),
    valueProposition: user.profile?.valueProposition ?? "—",
    industry: user.profile?.industry ?? "—",
    status: user.profile?.accountStatus ?? "ACTIVE",
    identities: user.identities.length
      ? user.identities.map((id) => ({
          provider: id.provider,
          value: id.value,
          verified: id.verified,
        }))
      : [
          { provider: "email", value: user.email, verified: true },
          ...(user.phone
            ? [{ provider: "phone", value: user.phone, verified: true }]
            : []),
        ],
    events: user.organizedEvents.map((e) => ({
      id: e.id,
      name: e.name,
      type: e.type,
      startDate: e.startDate?.toISOString() ?? null,
    })),
    connections: {
      total: allConnections.length,
      depthDistribution: depthBuckets,
    },
    points: {
      balance: user.profile?.pointsBalance ?? 0,
      ledger: user.pointsLedger.map((p) => ({
        id: p.id,
        amount: p.amount,
        reason: REASON_LABELS[p.reason] ?? p.reason,
        createdAt: p.createdAt.toISOString(),
      })),
    },
    feed: user.feedItems.map((f) => ({
      id: f.id,
      type: f.type,
      content: f.content,
      aiScore: f.aiScore,
      triggerReason: f.triggerReason,
      createdAt: f.createdAt.toISOString(),
    })),
    roles: user.roleAssignments,
  };
}

export async function fetchPlatformConnections(params?: {
  eventId?: string;
  source?: string;
  status?: string;
}) {
  const where = {
    ...(params?.eventId ? { eventId: params.eventId } : {}),
    ...(params?.source ? { source: params.source as ConnectionSource } : {}),
    ...(params?.status ? { status: params.status as never } : {}),
  };

  const rows = await prisma.businessConnection.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { interactions: { orderBy: { occurredAt: "asc" } } },
  });

  if (rows.length === 0) {
    return null;
  }

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [total, monthlyNew, activeCount, aiCount] = await Promise.all([
    prisma.businessConnection.count({
      where: { status: { not: "DISCONNECTED" } },
    }),
    prisma.businessConnection.count({
      where: { createdAt: { gte: monthStart } },
    }),
    prisma.businessConnection.count({ where: { status: "ACTIVE" } }),
    prisma.businessConnection.count({
      where: { source: "AI_RECOMMEND", status: { not: "DISCONNECTED" } },
    }),
  ]);

  const avgDepth =
    rows.length > 0
      ? Math.round((rows.reduce((s, r) => s + r.depth, 0) / rows.length) * 10) / 10
      : 0;

  const sourceTrend = Array.from({ length: 6 }, (_, i) => ({
    month: `${i + 1}月`,
    扫码: 20 + i * 3,
    AI推荐: 15 + i * 4,
    SN: 8 + i * 2,
    引荐: 5 + i,
  }));

  const originMap = new Map<string, number>();
  for (const row of rows) {
    const label = row.originContext ?? SOURCE_LABELS[row.source];
    originMap.set(label, (originMap.get(label) ?? 0) + 1);
  }

  return {
    health: {
      total,
      monthlyNew,
      activeRate: total > 0 ? Math.round((activeCount / total) * 100) : 0,
      aiRate: total > 0 ? Math.round((aiCount / total) * 100) : 0,
      avgDepth,
    },
    sourceTrend,
    originContext: [...originMap.entries()].map(([name, value]) => ({
      name,
      value,
    })),
    connections: rows.map((row) => ({
      id: row.id,
      userA: { name: row.userAName, company: row.userACompany ?? "—" },
      userB: { name: row.userBName, company: row.userBCompany ?? "—" },
      source: SOURCE_LABELS[row.source],
      event: row.eventName ?? "—",
      depth: row.depth,
      aiScore: row.aiScore ?? 0,
      createdAt: row.createdAt.toISOString(),
      status: row.status,
      interactions: row.interactions.map((i) => ({
        time: i.occurredAt.toISOString(),
        type: i.type,
        desc: i.description,
      })),
    })),
  };
}

export async function fetchPlatformPointsStats() {
  const ledgerCount = await prisma.pointsLedger.count();
  if (ledgerCount === 0) return null;

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [profiles, monthLedger, redemptions] = await Promise.all([
    prisma.userProfile.findMany({ select: { pointsBalance: true, userId: true } }),
    prisma.pointsLedger.findMany({ where: { createdAt: { gte: monthStart } } }),
    prisma.pointsRedemption.groupBy({
      by: ["benefitName"],
      _sum: { pointsSpent: true },
      _count: true,
    }),
  ]);

  const totalCirculation = profiles.reduce((s, p) => s + p.pointsBalance, 0);
  const monthlyIssued = monthLedger
    .filter((l) => l.amount > 0)
    .reduce((s, l) => s + l.amount, 0);
  const monthlySpent = Math.abs(
    monthLedger.filter((l) => l.amount < 0).reduce((s, l) => s + l.amount, 0),
  );

  const reasonMap = new Map<string, number>();
  for (const l of monthLedger.filter((x) => x.amount > 0)) {
    const label = REASON_LABELS[l.reason];
    reasonMap.set(label, (reasonMap.get(label) ?? 0) + l.amount);
  }

  const topUsers = await prisma.userProfile.findMany({
    orderBy: { pointsBalance: "desc" },
    take: 20,
    include: { user: { select: { name: true } } },
  });

  const monthlyByUser = new Map<string, number>();
  for (const l of monthLedger.filter((x) => x.amount > 0)) {
    monthlyByUser.set(l.userId, (monthlyByUser.get(l.userId) ?? 0) + l.amount);
  }

  return {
    stats: {
      totalCirculation,
      monthlyIssued,
      monthlySpent,
      activeUsers: profiles.filter((p) => p.pointsBalance > 0).length,
    },
    sources: [...reasonMap.entries()]
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count),
    redemptions: redemptions.map((r) => ({
      name: r.benefitName,
      value: r._count,
    })),
    topUsers: topUsers.map((p, i) => ({
      rank: i + 1,
      name: p.user.name,
      company: p.company ?? "—",
      monthly: monthlyByUser.get(p.userId) ?? 0,
      balance: p.pointsBalance,
      source: "签到奖励",
    })),
    suspicious: [],
  };
}

export async function adjustUserPoints(
  userId: string,
  amount: number,
  reason: string,
) {
  await prisma.$transaction([
    prisma.pointsLedger.create({
      data: {
        userId,
        amount,
        reason: "ADJUSTMENT",
        note: reason,
      },
    }),
    prisma.userProfile.upsert({
      where: { userId },
      create: { userId, pointsBalance: Math.max(0, amount) },
      update: { pointsBalance: { increment: amount } },
    }),
  ]);
}

export async function disconnectBusinessConnection(connectionId: string) {
  await prisma.businessConnection.update({
    where: { id: connectionId },
    data: { status: "DISCONNECTED" },
  });
}

export { SOURCE_LABELS, REASON_LABELS };
