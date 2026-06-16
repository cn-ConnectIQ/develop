import { type AccountType, prisma } from "@connectiq/database";

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  CONFERENCE_ORGANIZER: "会议主办方",
  EXPO_ORGANIZER: "展览主办方",
  EXHIBITOR: "参展商",
};

export type OrgProfileData = {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  coverUrl: string | null;
  bio: string | null;
  website: string | null;
  contactEmail: string | null;
  accountType: AccountType;
  orgCreditCode: string | null;
  isVerified: boolean;
  memberCount: number;
  eventCount: number;
  followerCount: number;
};

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function normalizeOrgSlug(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function validateOrgSlug(slug: string) {
  if (slug.length < 3) return "链接至少 3 个字符";
  if (slug.length > 48) return "链接最多 48 个字符";
  if (!SLUG_PATTERN.test(slug)) return "仅支持小写字母、数字和连字符";
  return null;
}

export function maskCreditCode(code: string | null) {
  if (!code) return "—";
  if (code.length <= 6) return code;
  return `${code.slice(0, 3)}***${code.slice(-3)}`;
}

function serializeOrg(org: Awaited<ReturnType<typeof fetchOrg>>): OrgProfileData {
  if (!org) throw new Error("组织不存在");
  return {
    id: org.id,
    name: org.name,
    slug: org.slug,
    logoUrl: org.logoUrl,
    coverUrl: org.coverUrl,
    bio: org.bio,
    website: org.website,
    contactEmail: org.contactEmail,
    accountType: org.accountType,
    orgCreditCode: org.orgCreditCode,
    isVerified: org.isVerified,
    memberCount: org.memberCount,
    eventCount: org.eventCount,
    followerCount: org.followerCount,
  };
}

async function fetchOrg(orgId: string) {
  return prisma.organization.findUnique({ where: { id: orgId } });
}

export async function getOrgProfile(orgId: string) {
  const org = await fetchOrg(orgId);
  if (!org) return null;
  return serializeOrg(org);
}

export async function checkSlugAvailable(slug: string, excludeOrgId?: string) {
  const normalized = normalizeOrgSlug(slug);
  const formatError = validateOrgSlug(normalized);
  if (formatError) {
    return { available: false, slug: normalized, reason: formatError };
  }

  const existing = await prisma.organization.findUnique({
    where: { slug: normalized },
    select: { id: true },
  });

  const available = !existing || existing.id === excludeOrgId;
  return {
    available,
    slug: normalized,
    reason: available ? null : "已被使用",
  };
}

export type UpdateOrgProfileInput = {
  slug?: string;
  bio?: string | null;
  website?: string | null;
  contactEmail?: string | null;
  logoUrl?: string | null;
  coverUrl?: string | null;
};

export async function updateOrgProfile(orgId: string, input: UpdateOrgProfileInput) {
  const org = await fetchOrg(orgId);
  if (!org) return null;

  const data: UpdateOrgProfileInput = {};

  if (input.slug !== undefined) {
    const normalized = normalizeOrgSlug(input.slug);
    const formatError = validateOrgSlug(normalized);
    if (formatError) {
      throw new Error(formatError);
    }
    if (normalized !== org.slug) {
      const check = await checkSlugAvailable(normalized, orgId);
      if (!check.available) {
        throw new Error("主页链接已被使用");
      }
    }
    data.slug = normalized;
  }

  if (input.bio !== undefined) {
    data.bio = input.bio?.trim().slice(0, 300) || null;
  }
  if (input.website !== undefined) {
    data.website = input.website?.trim() || null;
  }
  if (input.contactEmail !== undefined) {
    data.contactEmail = input.contactEmail?.trim() || null;
  }
  if (input.logoUrl !== undefined) {
    data.logoUrl = input.logoUrl;
  }
  if (input.coverUrl !== undefined) {
    data.coverUrl = input.coverUrl;
  }

  const updated = await prisma.organization.update({
    where: { id: orgId },
    data,
  });

  return serializeOrg(updated);
}
