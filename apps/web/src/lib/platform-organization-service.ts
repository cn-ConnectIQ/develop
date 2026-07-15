import {
  AdminStatus,
  BillingLedgerResource,
  BillingLedgerType,
  prisma,
} from "@connectiq/database";
import { creditOrgWallet, getOrCreateOrgWallet } from "@/lib/billing/wallet-service";

export class PlatformOrganizationError extends Error {
  constructor(
    message: string,
    readonly code: "NOT_FOUND" | "VALIDATION" | "FORBIDDEN",
  ) {
    super(message);
    this.name = "PlatformOrganizationError";
  }
}

const STATUS_FILTERS = new Set([
  "ALL",
  "APPROVED",
  "TRIAL",
  "PENDING_REVIEW",
  "SUSPENDED",
  "REJECTED",
]);

function daysAgo(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

async function usageSince(orgId: string, since: Date) {
  const rows = await prisma.billingLedger.groupBy({
    by: ["resource"],
    where: {
      orgId,
      type: BillingLedgerType.DEBIT,
      createdAt: { gte: since },
    },
    _sum: { amount: true },
  });
  const map: Record<string, number> = {
    SMS: 0,
    EMAIL: 0,
    INTERACTION_POINT: 0,
  };
  for (const row of rows) {
    map[row.resource] = row._sum.amount ?? 0;
  }
  return {
    smsUsed30d: map.SMS ?? 0,
    emailUsed30d: map.EMAIL ?? 0,
    interactionUsed30d: map.INTERACTION_POINT ?? 0,
  };
}

export async function listPlatformOrganizations(input: {
  search?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}) {
  const page = Math.max(1, input.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, input.pageSize ?? 20));
  const status =
    input.status && STATUS_FILTERS.has(input.status) ? input.status : "ALL";
  const search = input.search?.trim() || undefined;

  const where = {
    ...(status !== "ALL" ? { adminStatus: status as AdminStatus } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" as const } },
            { slug: { contains: search, mode: "insensitive" as const } },
            {
              contactEmail: {
                contains: search,
                mode: "insensitive" as const,
              },
            },
          ],
        }
      : {}),
  };

  const [total, orgs, counts] = await Promise.all([
    prisma.organization.count({ where }),
    prisma.organization.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        name: true,
        slug: true,
        contactEmail: true,
        adminStatus: true,
        totalEvents: true,
        totalParticipants: true,
        eventCount: true,
        overdraftLimit: true,
        createdAt: true,
        updatedAt: true,
        owner: { select: { id: true, name: true, email: true, phone: true } },
        wallet: {
          select: {
            smsBalance: true,
            emailBalance: true,
            interactionPointsBalance: true,
          },
        },
        _count: { select: { events: true } },
      },
    }),
    prisma.organization.groupBy({
      by: ["adminStatus"],
      _count: { _all: true },
    }),
  ]);

  const since = daysAgo(30);
  const items = await Promise.all(
    orgs.map(async (org) => {
      const usage = await usageSince(org.id, since);
      return {
        id: org.id,
        name: org.name,
        slug: org.slug,
        contactEmail: org.contactEmail,
        adminStatus: org.adminStatus,
        totalEvents: org.totalEvents || org.eventCount || org._count.events,
        totalParticipants: org.totalParticipants,
        overdraftLimit: org.overdraftLimit,
        createdAt: org.createdAt.toISOString(),
        updatedAt: org.updatedAt.toISOString(),
        owner: org.owner,
        balances: {
          smsBalance: org.wallet?.smsBalance ?? 0,
          emailBalance: org.wallet?.emailBalance ?? 0,
          interactionPointsBalance:
            org.wallet?.interactionPointsBalance ?? 0,
        },
        usage,
      };
    }),
  );

  const statusCounts = {
    all: 0,
    approved: 0,
    trial: 0,
    pending: 0,
    suspended: 0,
    rejected: 0,
  };
  for (const row of counts) {
    statusCounts.all += row._count._all;
    if (row.adminStatus === AdminStatus.APPROVED) {
      statusCounts.approved = row._count._all;
    } else if (row.adminStatus === AdminStatus.TRIAL) {
      statusCounts.trial = row._count._all;
    } else if (row.adminStatus === AdminStatus.PENDING_REVIEW) {
      statusCounts.pending = row._count._all;
    } else if (row.adminStatus === AdminStatus.SUSPENDED) {
      statusCounts.suspended = row._count._all;
    } else if (row.adminStatus === AdminStatus.REJECTED) {
      statusCounts.rejected = row._count._all;
    }
  }

  return { items, total, page, pageSize, counts: statusCounts };
}

export async function getPlatformOrganizationDetail(orgId: string) {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    include: {
      owner: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          userType: true,
        },
      },
      wallet: true,
      events: {
        orderBy: { startDate: "desc" },
        take: 20,
        select: {
          id: true,
          name: true,
          status: true,
          startDate: true,
          endDate: true,
          _count: { select: { participants: true } },
        },
      },
      staff: {
        take: 20,
        select: {
          id: true,
          role: true,
          user: { select: { id: true, name: true, email: true, phone: true } },
        },
      },
    },
  });

  if (!org) {
    throw new PlatformOrganizationError("组织不存在", "NOT_FOUND");
  }

  await getOrCreateOrgWallet(orgId);

  const [ledgers, orders, usage, liveParticipants] = await Promise.all([
    prisma.billingLedger.findMany({
      where: { orgId },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        type: true,
        resource: true,
        amount: true,
        balanceAfter: true,
        remark: true,
        createdAt: true,
        createdByUserId: true,
      },
    }),
    prisma.billingOrder.findMany({
      where: { orgId },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: {
        id: true,
        title: true,
        status: true,
        amountCents: true,
        paymentChannel: true,
        createdAt: true,
        paidAt: true,
        plan: {
          select: {
            code: true,
            name: true,
            kind: true,
          },
        },
      },
    }),
    usageSince(orgId, daysAgo(30)),
    prisma.participant.count({
      where: { event: { orgId } },
    }),
  ]);

  const wallet = await getOrCreateOrgWallet(orgId);

  return {
    id: org.id,
    name: org.name,
    slug: org.slug,
    contactEmail: org.contactEmail,
    adminStatus: org.adminStatus,
    industry: org.industry,
    website: org.website,
    overdraftLimit: org.overdraftLimit,
    totals: {
      events: org.totalEvents || org.eventCount || org.events.length,
      participants: Math.max(org.totalParticipants, liveParticipants),
      leads: org.totalLeads,
      connections: org.totalConnections,
    },
    createdAt: org.createdAt.toISOString(),
    updatedAt: org.updatedAt.toISOString(),
    owner: org.owner,
    staff: org.staff.map((s) => ({
      id: s.id,
      role: s.role,
      user: s.user,
    })),
    balances: {
      smsBalance: wallet.smsBalance,
      emailBalance: wallet.emailBalance,
      interactionPointsBalance: wallet.interactionPointsBalance,
    },
    usage,
    events: org.events.map((e) => ({
      id: e.id,
      name: e.name,
      status: e.status,
      startDate: e.startDate?.toISOString() ?? null,
      endDate: e.endDate?.toISOString() ?? null,
      participants: e._count.participants,
    })),
    ledgers: ledgers.map((l) => ({
      ...l,
      createdAt: l.createdAt.toISOString(),
    })),
    orders: orders.map((o) => ({
      ...o,
      createdAt: o.createdAt.toISOString(),
      paidAt: o.paidAt?.toISOString() ?? null,
    })),
  };
}

export async function creditPlatformOrganization(input: {
  orgId: string;
  resource: "SMS" | "EMAIL" | "INTERACTION_POINT";
  amount: number;
  remark: string;
  actorUserId: string;
}) {
  const amount = Math.floor(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new PlatformOrganizationError("充值数量必须为正整数", "VALIDATION");
  }
  if (amount > 1_000_000) {
    throw new PlatformOrganizationError("单次充值数量过大", "VALIDATION");
  }
  const remark = input.remark.trim();
  if (remark.length < 2) {
    throw new PlatformOrganizationError("请填写调账备注", "VALIDATION");
  }

  const org = await prisma.organization.findUnique({
    where: { id: input.orgId },
    select: { id: true, name: true },
  });
  if (!org) {
    throw new PlatformOrganizationError("组织不存在", "NOT_FOUND");
  }

  const resource =
    input.resource === "SMS"
      ? BillingLedgerResource.SMS
      : input.resource === "EMAIL"
        ? BillingLedgerResource.EMAIL
        : BillingLedgerResource.INTERACTION_POINT;

  await creditOrgWallet({
    orgId: input.orgId,
    resource,
    amount,
    remark: `[平台代充] ${remark}`,
    createdByUserId: input.actorUserId,
    type: BillingLedgerType.ADJUST,
  });

  return getPlatformOrganizationDetail(input.orgId);
}

export async function updatePlatformOrganizationStatus(input: {
  orgId: string;
  adminStatus: "APPROVED" | "SUSPENDED";
  actorUserId: string;
  remark?: string;
}) {
  const org = await prisma.organization.findUnique({
    where: { id: input.orgId },
    select: { id: true, adminStatus: true },
  });
  if (!org) {
    throw new PlatformOrganizationError("组织不存在", "NOT_FOUND");
  }

  if (
    input.adminStatus === "SUSPENDED" &&
    org.adminStatus === AdminStatus.SUSPENDED
  ) {
    return getPlatformOrganizationDetail(input.orgId);
  }
  if (
    input.adminStatus === "APPROVED" &&
    org.adminStatus === AdminStatus.APPROVED
  ) {
    return getPlatformOrganizationDetail(input.orgId);
  }

  await prisma.organization.update({
    where: { id: input.orgId },
    data: {
      adminStatus:
        input.adminStatus === "SUSPENDED"
          ? AdminStatus.SUSPENDED
          : AdminStatus.APPROVED,
    },
  });

  // remark reserved for future audit log
  void input.actorUserId;
  void input.remark;

  return getPlatformOrganizationDetail(input.orgId);
}

export async function updatePlatformOrganizationOverdraft(input: {
  orgId: string;
  overdraftLimit: number;
}) {
  const limit = Math.floor(input.overdraftLimit);
  if (!Number.isFinite(limit) || limit < 0 || limit > 100_000) {
    throw new PlatformOrganizationError(
      "透支额度须在 0–100000 之间",
      "VALIDATION",
    );
  }

  const org = await prisma.organization.findUnique({
    where: { id: input.orgId },
    select: { id: true },
  });
  if (!org) {
    throw new PlatformOrganizationError("组织不存在", "NOT_FOUND");
  }

  await prisma.organization.update({
    where: { id: input.orgId },
    data: { overdraftLimit: limit },
  });

  return getPlatformOrganizationDetail(input.orgId);
}
