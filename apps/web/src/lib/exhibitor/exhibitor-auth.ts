import { InviteStatus, OrgStaffRole, prisma } from "@connectiq/database";
import { ErrorCode } from "@connectiq/types";
import type { Session } from "next-auth";
import { ApiError, requireAccountAdmin } from "@/lib/api-auth";
import { requireMobileAccountAdmin } from "@/lib/mobile-user-id";

export type ExhibitorBoothContext = {
  id: string;
  code: string;
  name: string;
  eventId: string;
  eventName: string;
  orgName: string;
  scanUrl: string;
};

function buildBoothScanUrl(eventId: string, boothId: string) {
  const base =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXTAUTH_URL ??
    "https://app.connectiq.cn";
  return `${base.replace(/\/$/, "")}/events/${eventId}?booth=${boothId}`;
}

export async function resolveExhibitorBooth(
  orgId: string,
): Promise<ExhibitorBoothContext | null> {
  const booth = await prisma.exhibitorBooth.findFirst({
    where: { companyOrgId: orgId },
    orderBy: { createdAt: "desc" },
    include: {
      event: { select: { id: true, name: true } },
      companyOrg: { select: { name: true } },
    },
  });

  if (!booth) return null;

  return {
    id: booth.id,
    code: booth.code,
    name: booth.name,
    eventId: booth.event.id,
    eventName: booth.event.name,
    orgName: booth.companyOrg.name,
    scanUrl: buildBoothScanUrl(booth.event.id, booth.id),
  };
}

/** 按组织或操作员/展商员工身份解析展位（支持同一账号多组织） */
export async function resolveExhibitorBoothForUser(
  userId: string,
  orgId: string,
): Promise<ExhibitorBoothContext | null> {
  const byOrg = await resolveExhibitorBooth(orgId);
  if (byOrg) return byOrg;

  const booth = await prisma.exhibitorBooth.findFirst({
    where: {
      OR: [
        { operatorUserId: userId },
        {
          companyOrg: {
            staff: {
              some: {
                userId,
                status: InviteStatus.ACCEPTED,
                role: { in: [OrgStaffRole.OWNER, OrgStaffRole.ADMIN] },
              },
            },
          },
        },
      ],
    },
    orderBy: { updatedAt: "desc" },
    include: {
      event: { select: { id: true, name: true } },
      companyOrg: { select: { name: true } },
    },
  });

  if (!booth) return null;

  return {
    id: booth.id,
    code: booth.code,
    name: booth.name,
    eventId: booth.event.id,
    eventName: booth.event.name,
    orgName: booth.companyOrg.name,
    scanUrl: buildBoothScanUrl(booth.event.id, booth.id),
  };
}

export async function requireExhibitorAdmin(request?: Request): Promise<{
  session?: Session;
  userId?: string;
  orgId: string;
  booth: ExhibitorBoothContext;
}> {
  const sessionResult = await requireAccountAdmin();
  if (!("error" in sessionResult)) {
    const { session, orgId } = sessionResult;
    const booth = await resolveExhibitorBoothForUser(session.user.id, orgId);
    if (!booth) {
      throw new ApiError("未找到关联展位", ErrorCode.FORBIDDEN, 403);
    }
    return { session, orgId, booth };
  }

  if (!request) {
    throw new ApiError("无权访问", ErrorCode.FORBIDDEN, 403);
  }

  const { userId, orgId } = await requireMobileAccountAdmin(request);
  const booth = await resolveExhibitorBoothForUser(userId, orgId);
  if (!booth) {
    throw new ApiError("未找到关联展位", ErrorCode.FORBIDDEN, 403);
  }

  return { userId, orgId, booth };
}

export async function resolveExhibitorOperatorUserId(
  boothId: string,
): Promise<string | null> {
  const booth = await prisma.exhibitorBooth.findUnique({
    where: { id: boothId },
    select: {
      operatorUserId: true,
      companyOrg: { select: { ownerId: true } },
    },
  });
  return booth?.operatorUserId ?? booth?.companyOrg.ownerId ?? null;
}
