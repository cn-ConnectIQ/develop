import { prisma } from "@connectiq/database";

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
