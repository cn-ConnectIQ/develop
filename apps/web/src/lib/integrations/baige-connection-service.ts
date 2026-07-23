import {
  PartnerConnectionStatus,
  prisma,
  type Prisma,
} from "@connectiq/database";
import {
  BAIGE_DEFAULT_SCOPES,
  BAIGE_PROVIDER,
} from "@/lib/integrations/baige-partner-constants";

export class BaigeConnectionError extends Error {
  constructor(
    message: string,
    public code: string,
  ) {
    super(message);
  }
}

export type UpsertBaigeConnectionInput = {
  orgId: string;
  externalOrgId: string;
  linkedByUserId?: string | null;
  scopes?: string[];
  accessToken?: string | null;
  refreshToken?: string | null;
  tokenExpiresAt?: Date | null;
  metadata?: Record<string, unknown> | null;
};

export async function upsertBaigeConnection(input: UpsertBaigeConnectionInput) {
  const externalOrgId = input.externalOrgId.trim();
  if (!externalOrgId) {
    throw new BaigeConnectionError("缺少百格组织 ID", "INVALID_EXTERNAL_ORG");
  }

  const org = await prisma.organization.findUnique({
    where: { id: input.orgId },
    select: { id: true, name: true, adminStatus: true },
  });
  if (!org) {
    throw new BaigeConnectionError("组织不存在", "ORG_NOT_FOUND");
  }

  const byExternal = await prisma.partnerConnection.findUnique({
    where: {
      provider_externalOrgId: {
        provider: BAIGE_PROVIDER,
        externalOrgId,
      },
    },
  });
  if (byExternal && byExternal.orgId !== input.orgId) {
    throw new BaigeConnectionError(
      "该百格组织已绑定其他玖莅账号",
      "EXTERNAL_ORG_TAKEN",
    );
  }

  const scopes = input.scopes?.length
    ? input.scopes
    : [...BAIGE_DEFAULT_SCOPES];

  return prisma.partnerConnection.upsert({
    where: {
      provider_orgId: { provider: BAIGE_PROVIDER, orgId: input.orgId },
    },
    create: {
      provider: BAIGE_PROVIDER,
      orgId: input.orgId,
      externalOrgId,
      status: PartnerConnectionStatus.ACTIVE,
      scopes,
      accessToken: input.accessToken ?? null,
      refreshToken: input.refreshToken ?? null,
      tokenExpiresAt: input.tokenExpiresAt ?? null,
      linkedByUserId: input.linkedByUserId ?? null,
      metadata: (input.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
    },
    update: {
      externalOrgId,
      status: PartnerConnectionStatus.ACTIVE,
      scopes,
      accessToken: input.accessToken ?? undefined,
      refreshToken: input.refreshToken ?? undefined,
      tokenExpiresAt: input.tokenExpiresAt ?? undefined,
      linkedByUserId: input.linkedByUserId ?? undefined,
      metadata: (input.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  });
}

export async function getBaigeConnectionByOrgId(orgId: string) {
  return prisma.partnerConnection.findUnique({
    where: {
      provider_orgId: { provider: BAIGE_PROVIDER, orgId },
    },
  });
}

export async function getBaigeConnectionByExternalOrgId(externalOrgId: string) {
  return prisma.partnerConnection.findUnique({
    where: {
      provider_externalOrgId: {
        provider: BAIGE_PROVIDER,
        externalOrgId: externalOrgId.trim(),
      },
    },
  });
}

export async function revokeBaigeConnection(orgId: string) {
  const existing = await getBaigeConnectionByOrgId(orgId);
  if (!existing) {
    throw new BaigeConnectionError("尚未绑定百格", "NOT_LINKED");
  }

  return prisma.partnerConnection.update({
    where: { id: existing.id },
    data: {
      status: PartnerConnectionStatus.REVOKED,
      accessToken: null,
      refreshToken: null,
      tokenExpiresAt: null,
    },
  });
}

export function formatBaigeConnectionStatus(
  row: Awaited<ReturnType<typeof getBaigeConnectionByOrgId>>,
) {
  if (!row || row.status === PartnerConnectionStatus.REVOKED) {
    return {
      linked: false,
      status: "disconnected" as const,
      externalOrgId: null as string | null,
      scopes: [] as string[],
      linkedAt: null as string | null,
    };
  }

  return {
    linked: row.status === PartnerConnectionStatus.ACTIVE,
    status:
      row.status === PartnerConnectionStatus.PENDING
        ? ("pending" as const)
        : ("linked" as const),
    externalOrgId: row.externalOrgId,
    scopes: row.scopes,
    linkedAt: row.createdAt.toISOString(),
  };
}
