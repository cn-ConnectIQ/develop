import {
  AccountType,
  AdminStatus,
  prisma,
  type Prisma,
} from "@connectiq/database";

function generateExhibitorSlug(name: string): string {
  const trimmed = name.trim();
  const asciiSlug = trimmed
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, 32);

  if (asciiSlug.length >= 3) {
    return asciiSlug;
  }

  const code = trimmed
    .split("")
    .slice(0, 3)
    .map((c) => c.charCodeAt(0).toString(16).slice(-2))
    .join("");
  return `exhibitor-${code}-${Date.now().toString().slice(-4)}`;
}

/** 将 API 传入的展商用户 ID 或组织 ID 解析为 companyOrgId */
export async function resolveCompanyOrgId(
  exhibitorIdOrOrgId: string,
): Promise<string | null> {
  const asOrg = await prisma.organization.findFirst({
    where: { id: exhibitorIdOrOrgId, accountType: "EXHIBITOR" },
    select: { id: true },
  });
  if (asOrg) return asOrg.id;

  const staff = await prisma.orgStaff.findFirst({
    where: {
      userId: exhibitorIdOrOrgId,
      org: { accountType: "EXHIBITOR" },
    },
    select: { orgId: true },
  });
  return staff?.orgId ?? null;
}

async function resolveUniqueExhibitorSlug(
  tx: Prisma.TransactionClient | typeof prisma,
  name: string,
): Promise<string> {
  const baseSlug = generateExhibitorSlug(name);
  let slug = baseSlug;
  let suffix = 1000;
  while (await tx.organization.findUnique({ where: { slug } })) {
    slug = `${baseSlug}-${suffix++}`;
  }
  return slug;
}

/** 本场活动已分配过展位的展商组织（不再拉全平台展商） */
export async function listEventExhibitorOrgs(eventId: string) {
  const booths = await prisma.exhibitorBooth.findMany({
    where: { eventId },
    select: {
      companyOrgId: true,
      companyOrg: { select: { id: true, name: true, slug: true } },
    },
  });

  const seen = new Set<string>();
  const orgs: Array<{ id: string; name: string; slug: string }> = [];
  for (const booth of booths) {
    if (seen.has(booth.companyOrgId)) continue;
    seen.add(booth.companyOrgId);
    orgs.push(booth.companyOrg);
  }
  return orgs.sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));
}

/** 按名称创建展商组织（主办在本场分配展位时使用） */
export async function createExhibitorOrgByName(name: string) {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error("请填写展商企业名称");
  }

  const slug = await resolveUniqueExhibitorSlug(prisma, trimmed);
  return prisma.organization.create({
    data: {
      name: trimmed,
      slug,
      accountType: AccountType.EXHIBITOR,
      adminStatus: AdminStatus.APPROVED,
      isVerified: false,
    },
    select: { id: true, name: true, slug: true },
  });
}

/** 解析展位所属展商：已有 ID，或按名称新建 */
export async function resolveOrCreateExhibitorOrg(input: {
  exhibitorId?: string;
  exhibitorName?: string;
}): Promise<string> {
  if (input.exhibitorId?.trim()) {
    const id = await resolveCompanyOrgId(input.exhibitorId.trim());
    if (!id) throw new Error("未找到展商组织");
    return id;
  }

  const created = await createExhibitorOrgByName(input.exhibitorName ?? "");
  return created.id;
}

type BoothWithCompanyOrg = {
  companyOrg: { id: string; name: string; [key: string]: unknown };
  [key: string]: unknown;
};

/** API 响应兼容：companyOrg → exhibitor */
export function withLegacyExhibitor<T extends BoothWithCompanyOrg>(
  booth: T,
): Omit<T, "companyOrg"> & { exhibitor: T["companyOrg"] } {
  const { companyOrg, ...rest } = booth;
  return { ...rest, exhibitor: companyOrg };
}
