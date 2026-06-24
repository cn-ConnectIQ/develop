import {
  AdminStatus,
  AccountType,
  EventStatus,
  OrgJoinSource,
  prisma,
} from "@connectiq/database";
import { ErrorCode } from "@connectiq/types";
import { ApiError } from "@/lib/api-auth";
import { syncOrganizationStats } from "@/lib/org-stats";

export type ApiPublicOrg = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  cover_url: string | null;
  bio: string | null;
  website: string | null;
  contact_email: string | null;
  account_type: AccountType;
  industry: string | null;
  company_size: string | null;
  headquarters: string | null;
  founded_year: number | null;
  is_verified: boolean;
  member_count: number;
  event_count: number;
  follower_count: number;
};

export type ApiPublicOrgEvent = {
  id: string;
  name: string;
  event_type: string;
  starts_at: string;
  ends_at: string;
  city?: string;
  venue?: string;
  status: "DRAFT" | "PUBLISHED" | "LIVE" | "ENDED";
  cover_url?: string | null;
  participant_count?: number;
  attended?: boolean;
};

export type ApiOrgDetailPayload = {
  org: ApiPublicOrg;
  upcomingEvents: ApiPublicOrgEvent[];
  pastEvents: ApiPublicOrgEvent[];
  isFollowing: boolean;
  myEventCount: number;
};

function splitLocation(location: string | null | undefined): {
  city?: string;
  venue?: string;
} {
  if (!location) return {};
  const parts = location.split("·").map((s) => s.trim()).filter(Boolean);
  if (parts.length >= 2) {
    return { city: parts[0], venue: parts.slice(1).join(" · ") };
  }
  return { venue: location };
}

function mapEventStatus(status: EventStatus): ApiPublicOrgEvent["status"] {
  if (status === EventStatus.LIVE) return "LIVE";
  if (status === EventStatus.PUBLISHED) return "PUBLISHED";
  if (status === EventStatus.ARCHIVED) return "ENDED";
  return "DRAFT";
}

function serializeOrgEvent(
  event: {
    id: string;
    name: string;
    type: string;
    status: EventStatus;
    location: string | null;
    startDate: Date | null;
    endDate: Date | null;
    _count: { participants: number };
  },
  attended?: boolean,
): ApiPublicOrgEvent {
  const loc = splitLocation(event.location);
  return {
    id: event.id,
    name: event.name,
    event_type: event.type,
    starts_at: event.startDate?.toISOString() ?? "",
    ends_at: event.endDate?.toISOString() ?? "",
    city: loc.city,
    venue: loc.venue,
    status: mapEventStatus(event.status),
    cover_url: null,
    participant_count: event._count.participants,
    attended,
  };
}

async function countUserOrgEvents(userId: string, orgId: string): Promise<number> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, phone: true },
  });
  if (!user) return 0;

  const or: Array<{ email?: string; phone?: string }> = [];
  if (user.email) or.push({ email: user.email });
  if (user.phone) or.push({ phone: user.phone });
  if (or.length === 0) return 0;

  return prisma.participant.count({
    where: {
      OR: or,
      event: { orgId },
    },
  });
}

async function getAttendedEventIds(userId: string, eventIds: string[]): Promise<Set<string>> {
  if (eventIds.length === 0) return new Set();

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, phone: true },
  });
  if (!user) return new Set();

  const or: Array<{ email?: string; phone?: string }> = [];
  if (user.email) or.push({ email: user.email });
  if (user.phone) or.push({ phone: user.phone });
  if (or.length === 0) return new Set();

  const rows = await prisma.participant.findMany({
    where: {
      eventId: { in: eventIds },
      OR: or,
    },
    select: { eventId: true },
  });

  return new Set(rows.map((r) => r.eventId));
}

export async function resolveApprovedOrgBySlug(slug: string) {
  const org = await prisma.organization.findFirst({
    where: {
      slug,
      adminStatus: AdminStatus.APPROVED,
    },
  });

  if (!org) {
    throw new ApiError("组织不存在", ErrorCode.NOT_FOUND, 404);
  }

  return org;
}

export async function resolveApprovedOrgIdBySlug(slug: string) {
  const org = await resolveApprovedOrgBySlug(slug);
  return org.id;
}

export async function getOrgPublicDetail(
  slug: string,
  userId?: string,
): Promise<ApiOrgDetailPayload> {
  const org = await resolveApprovedOrgBySlug(slug);
  await syncOrganizationStats(org.id);
  const freshOrg = await prisma.organization.findUniqueOrThrow({
    where: { id: org.id },
  });

  const now = new Date();

  const [upcomingRows, pastRows] = await Promise.all([
    prisma.event.findMany({
      where: {
        orgId: freshOrg.id,
        status: { in: [EventStatus.PUBLISHED, EventStatus.LIVE] },
      },
      orderBy: { startDate: "asc" },
      take: 5,
      include: { _count: { select: { participants: true } } },
    }),
    prisma.event.findMany({
      where: {
        orgId: freshOrg.id,
        status: {
          in: [EventStatus.PUBLISHED, EventStatus.LIVE, EventStatus.ARCHIVED],
        },
        OR: [{ status: EventStatus.ARCHIVED }, { endDate: { lt: now } }],
      },
      orderBy: { startDate: "desc" },
      take: 10,
      include: { _count: { select: { participants: true } } },
    }),
  ]);

  let isFollowing = false;
  let myEventCount = 0;

  if (userId) {
    const [membership, eventCount] = await Promise.all([
      prisma.orgMember.findUnique({
        where: { orgId_userId: { orgId: freshOrg.id, userId } },
        select: { isFollowing: true },
      }),
      countUserOrgEvents(userId, freshOrg.id),
    ]);
    isFollowing = membership?.isFollowing ?? false;
    myEventCount = eventCount;
  }

  const pastIds = pastRows.map((e) => e.id);
  const attendedSet = userId
    ? await getAttendedEventIds(userId, pastIds)
    : new Set<string>();

  return {
    org: {
      id: freshOrg.id,
      name: freshOrg.name,
      slug: freshOrg.slug,
      logo_url: freshOrg.logoUrl,
      cover_url: freshOrg.coverUrl,
      bio: freshOrg.bio,
      website: freshOrg.website,
      contact_email: freshOrg.contactEmail,
      account_type: freshOrg.accountType,
      industry: freshOrg.industry,
      company_size: freshOrg.companySize,
      headquarters: freshOrg.headquarters,
      founded_year: freshOrg.foundedYear,
      is_verified: freshOrg.isVerified,
      member_count: freshOrg.memberCount,
      event_count: freshOrg.eventCount,
      follower_count: freshOrg.followerCount,
    },
    upcomingEvents: upcomingRows.map((e) => serializeOrgEvent(e)),
    pastEvents: pastRows.map((e) =>
      serializeOrgEvent(e, attendedSet.has(e.id)),
    ),
    isFollowing,
    myEventCount,
  };
}

/** @deprecated MVP 不做 B2B 关注体系，见 lib/deprecated/b2b-social.ts */
export async function followOrganization(userId: string, orgId: string) {
  const org = await prisma.organization.findFirst({
    where: { id: orgId, adminStatus: AdminStatus.APPROVED },
    select: { id: true, name: true },
  });

  if (!org) {
    throw new ApiError("组织不存在", ErrorCode.NOT_FOUND, 404);
  }

  const existing = await prisma.orgMember.findUnique({
    where: { orgId_userId: { orgId, userId } },
    select: { isFollowing: true },
  });

  if (existing?.isFollowing) {
    const stats = await syncOrganizationStats(orgId);
    return {
      ok: true,
      orgName: org.name,
      follower_count: stats.followerCount,
    };
  }

  await prisma.orgMember.upsert({
    where: { orgId_userId: { orgId, userId } },
    create: {
      orgId,
      userId,
      joinSource: OrgJoinSource.FOLLOWED,
      isFollowing: true,
      isSubscribed: true,
    },
    update: {
      isFollowing: true,
      isSubscribed: true,
    },
  });

  const stats = await syncOrganizationStats(orgId);

  return {
    ok: true,
    orgName: org.name,
    follower_count: stats.followerCount,
  };
}

/** @deprecated MVP 不做 B2B 关注体系，见 lib/deprecated/b2b-social.ts */
export async function unfollowOrganization(userId: string, orgId: string) {
  const existing = await prisma.orgMember.findUnique({
    where: { orgId_userId: { orgId, userId } },
    select: { isFollowing: true },
  });

  if (existing?.isFollowing) {
    await prisma.orgMember.update({
      where: { orgId_userId: { orgId, userId } },
      data: { isFollowing: false, isSubscribed: false },
    });
  }

  const stats = await syncOrganizationStats(orgId);

  return {
    ok: true,
    follower_count: stats.followerCount,
  };
}

export async function resolveOptionalUserId(request: Request): Promise<string | null> {
  const auth = request.headers.get("authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return null;

  if (token === "dev-mock-token") {
    const demo = await prisma.user.findFirst({
      where: { phone: "13800138000" },
      select: { id: true },
    });
    return demo?.id ?? null;
  }

  try {
    const prefix = "mini_";
    if (token.startsWith(prefix)) {
      const rest = token.slice(prefix.length);
      const userId = rest.split("_")[0];
      if (userId) {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { id: true },
        });
        return user?.id ?? null;
      }
    }
  } catch {
    return null;
  }

  return null;
}
