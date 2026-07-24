import { prisma } from "@connectiq/database";
import { createExhibitorOrgByName } from "@/lib/exhibitor-booth-utils";

export type HostExhibitorDirectoryItem = {
  id: string;
  companyOrgId: string | null;
  companyName: string;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

function serialize(
  row: {
    id: string;
    companyOrgId: string | null;
    companyName: string;
    contactName: string | null;
    contactPhone: string | null;
    contactEmail: string | null;
    notes: string | null;
    createdAt: Date;
    updatedAt: Date;
  },
): HostExhibitorDirectoryItem {
  return {
    id: row.id,
    companyOrgId: row.companyOrgId,
    companyName: row.companyName,
    contactName: row.contactName,
    contactPhone: row.contactPhone,
    contactEmail: row.contactEmail,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** 将本主办历史展位上的展商企业幂等写入企业库 */
export async function syncHostExhibitorDirectoryFromHistory(hostOrgId: string) {
  const booths = await prisma.exhibitorBooth.findMany({
    where: { event: { orgId: hostOrgId } },
    select: {
      companyOrgId: true,
      companyOrg: { select: { id: true, name: true } },
    },
  });

  const byName = new Map<string, { companyOrgId: string; companyName: string }>();
  for (const booth of booths) {
    const name = booth.companyOrg?.name?.trim();
    if (!name || byName.has(name)) continue;
    byName.set(name, {
      companyOrgId: booth.companyOrg.id,
      companyName: name,
    });
  }

  for (const item of byName.values()) {
    const existing = await prisma.hostExhibitorDirectory.findFirst({
      where: { hostOrgId, companyName: item.companyName },
      select: { id: true, companyOrgId: true },
    });
    if (existing) {
      if (!existing.companyOrgId) {
        await prisma.hostExhibitorDirectory.update({
          where: { id: existing.id },
          data: { companyOrgId: item.companyOrgId },
        });
      }
      continue;
    }
    await prisma.hostExhibitorDirectory.create({
      data: {
        hostOrgId,
        companyName: item.companyName,
        companyOrgId: item.companyOrgId,
      },
    });
  }
}

export async function listHostExhibitorDirectory(hostOrgId: string) {
  try {
    await syncHostExhibitorDirectoryFromHistory(hostOrgId);
  } catch (error) {
    // 历史回填失败不阻断列表（例如缺唯一约束时的瞬时错误）
    console.error("[host-exhibitor-directory] sync failed:", error);
  }
  const rows = await prisma.hostExhibitorDirectory.findMany({
    where: { hostOrgId },
    orderBy: { companyName: "asc" },
  });
  return rows.map(serialize);
}

export async function createHostExhibitorDirectoryEntry(
  hostOrgId: string,
  input: {
    companyName: string;
    contactName?: string | null;
    contactPhone?: string | null;
    contactEmail?: string | null;
    notes?: string | null;
    companyOrgId?: string | null;
  },
) {
  const companyName = input.companyName.trim();
  if (!companyName) throw new Error("请填写企业名称");

  let companyOrgId = input.companyOrgId?.trim() || null;
  if (!companyOrgId) {
    const org = await createExhibitorOrgByName(companyName);
    companyOrgId = org.id;
  }

  try {
    const row = await prisma.hostExhibitorDirectory.create({
      data: {
        hostOrgId,
        companyName,
        companyOrgId,
        contactName: input.contactName?.trim() || null,
        contactPhone: input.contactPhone?.trim() || null,
        contactEmail: input.contactEmail?.trim() || null,
        notes: input.notes?.trim() || null,
      },
    });
    return serialize(row);
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code: string }).code === "P2002"
    ) {
      throw new Error("该企业已在参展企业库中");
    }
    throw error;
  }
}

export async function updateHostExhibitorDirectoryEntry(
  hostOrgId: string,
  id: string,
  input: {
    companyName?: string;
    contactName?: string | null;
    contactPhone?: string | null;
    contactEmail?: string | null;
    notes?: string | null;
  },
) {
  const existing = await prisma.hostExhibitorDirectory.findFirst({
    where: { id, hostOrgId },
  });
  if (!existing) throw new Error("企业不存在");

  const companyName =
    input.companyName !== undefined
      ? input.companyName.trim()
      : existing.companyName;
  if (!companyName) throw new Error("请填写企业名称");

  try {
    const row = await prisma.hostExhibitorDirectory.update({
      where: { id },
      data: {
        companyName,
        contactName:
          input.contactName !== undefined
            ? input.contactName?.trim() || null
            : undefined,
        contactPhone:
          input.contactPhone !== undefined
            ? input.contactPhone?.trim() || null
            : undefined,
        contactEmail:
          input.contactEmail !== undefined
            ? input.contactEmail?.trim() || null
            : undefined,
        notes:
          input.notes !== undefined ? input.notes?.trim() || null : undefined,
      },
    });

    if (
      existing.companyOrgId &&
      companyName !== existing.companyName
    ) {
      await prisma.organization.update({
        where: { id: existing.companyOrgId },
        data: { name: companyName },
      });
    }

    return serialize(row);
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code: string }).code === "P2002"
    ) {
      throw new Error("该企业名称已存在");
    }
    throw error;
  }
}

export async function deleteHostExhibitorDirectoryEntry(
  hostOrgId: string,
  id: string,
) {
  const existing = await prisma.hostExhibitorDirectory.findFirst({
    where: { id, hostOrgId },
    select: { id: true },
  });
  if (!existing) throw new Error("企业不存在");
  await prisma.hostExhibitorDirectory.delete({ where: { id } });
  return { deleted: true };
}

/** 展位分配用：企业库 + 本场已有展商（去重） */
export async function listAssignableExhibitorsForEvent(
  hostOrgId: string,
  eventId: string,
) {
  await syncHostExhibitorDirectoryFromHistory(hostOrgId);

  const [directory, boothOrgs] = await Promise.all([
    prisma.hostExhibitorDirectory.findMany({
      where: { hostOrgId },
      select: {
        companyOrgId: true,
        companyName: true,
      },
      orderBy: { companyName: "asc" },
    }),
    prisma.exhibitorBooth.findMany({
      where: { eventId },
      select: {
        companyOrgId: true,
        companyOrg: { select: { id: true, name: true, slug: true } },
      },
    }),
  ]);

  const map = new Map<
    string,
    { id: string; name: string; slug: string | null; source: "directory" | "event" }
  >();

  for (const row of directory) {
    if (!row.companyOrgId) continue;
    map.set(row.companyOrgId, {
      id: row.companyOrgId,
      name: row.companyName,
      slug: null,
      source: "directory",
    });
  }

  for (const booth of boothOrgs) {
    if (map.has(booth.companyOrgId)) continue;
    map.set(booth.companyOrgId, {
      id: booth.companyOrg.id,
      name: booth.companyOrg.name,
      slug: booth.companyOrg.slug,
      source: "event",
    });
  }

  return [...map.values()].sort((a, b) =>
    a.name.localeCompare(b.name, "zh-CN"),
  );
}

/** 新建展位时：选已有 org，或新建并写入企业库 */
export async function resolveExhibitorForHostBooth(input: {
  hostOrgId: string;
  exhibitorId?: string;
  exhibitorName?: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
}): Promise<string> {
  if (input.exhibitorId?.trim()) {
    const id = input.exhibitorId.trim();
    const inDirectory = await prisma.hostExhibitorDirectory.findFirst({
      where: { hostOrgId: input.hostOrgId, companyOrgId: id },
      select: { id: true },
    });
    if (inDirectory) return id;

    const org = await prisma.organization.findFirst({
      where: { id, accountType: "EXHIBITOR" },
      select: { id: true, name: true },
    });
    if (!org) throw new Error("未找到展商组织");

    await prisma.hostExhibitorDirectory.upsert({
      where: {
        hostOrgId_companyName: {
          hostOrgId: input.hostOrgId,
          companyName: org.name,
        },
      },
      create: {
        hostOrgId: input.hostOrgId,
        companyName: org.name,
        companyOrgId: org.id,
      },
      update: { companyOrgId: org.id },
    });
    return org.id;
  }

  const name = input.exhibitorName?.trim();
  if (!name) throw new Error("请选择已有展商，或填写新展商企业名称");

  const existing = await prisma.hostExhibitorDirectory.findUnique({
    where: {
      hostOrgId_companyName: {
        hostOrgId: input.hostOrgId,
        companyName: name,
      },
    },
  });
  if (existing?.companyOrgId) return existing.companyOrgId;

  const created = await createHostExhibitorDirectoryEntry(input.hostOrgId, {
    companyName: name,
    contactName: input.contactName,
    contactPhone: input.contactPhone,
    contactEmail: input.contactEmail,
  });
  if (!created.companyOrgId) throw new Error("创建展商组织失败");
  return created.companyOrgId;
}
