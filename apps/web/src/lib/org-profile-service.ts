import { prisma } from "@connectiq/database";
import {
  validateFoundedYear,
} from "@/lib/org-profile-constants";
import { syncOrganizationStats } from "@/lib/org-stats";
import type { OrgProfileData } from "@/lib/org-profile-types";

export type { OrgProfileData } from "@/lib/org-profile-types";
export { maskOrgCreditCode as maskCreditCode } from "@/lib/mask-utils";

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

function serializeOrg(org: NonNullable<Awaited<ReturnType<typeof fetchOrg>>>): OrgProfileData {
  return {
    id: org.id,
    name: org.name,
    slug: org.slug,
    logoUrl: org.logoUrl,
    coverUrl: org.coverUrl,
    bio: org.bio,
    website: org.website,
    contactEmail: org.contactEmail,
    industry: org.industry,
    companySize: org.companySize,
    headquarters: org.headquarters,
    foundedYear: org.foundedYear,
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
  await syncOrganizationStats(orgId);
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
  industry?: string | null;
  companySize?: string | null;
  headquarters?: string | null;
  foundedYear?: number | null;
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
    const trimmed = input.website?.trim() || null;
    if (trimmed && !/^https?:\/\/.+/i.test(trimmed)) {
      throw new Error("官网地址需以 http:// 或 https:// 开头");
    }
    data.website = trimmed;
  }
  if (input.contactEmail !== undefined) {
    const trimmed = input.contactEmail?.trim() || null;
    if (trimmed && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      throw new Error("联系邮箱格式不正确");
    }
    data.contactEmail = trimmed;
  }
  if (input.logoUrl !== undefined) {
    data.logoUrl = input.logoUrl;
  }
  if (input.coverUrl !== undefined) {
    data.coverUrl = input.coverUrl;
  }
  if (input.industry !== undefined) {
    data.industry = input.industry?.trim() || null;
  }
  if (input.companySize !== undefined) {
    data.companySize = input.companySize?.trim() || null;
  }
  if (input.headquarters !== undefined) {
    data.headquarters = input.headquarters?.trim().slice(0, 100) || null;
  }
  if (input.foundedYear !== undefined) {
    const yearError = validateFoundedYear(input.foundedYear);
    if (yearError) throw new Error(yearError);
    data.foundedYear = input.foundedYear;
  }

  const updated = await prisma.organization.update({
    where: { id: orgId },
    data,
  });

  return serializeOrg(updated);
}
