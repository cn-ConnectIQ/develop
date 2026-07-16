import {
  InviteStatus,
  OrgStaffRole,
  SystemRole,
  prisma,
} from "@connectiq/database";
import { ErrorCode } from "@connectiq/types";
import type { Session } from "next-auth";
import { ApiError, requireAccountAdmin } from "@/lib/api-auth";
import { buildParticipantContactOrForUser } from "@/lib/interaction/participant-user";
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
  eventId?: string | null,
): Promise<ExhibitorBoothContext | null> {
  const booth = await prisma.exhibitorBooth.findFirst({
    where: {
      companyOrgId: orgId,
      ...(eventId ? { eventId } : {}),
    },
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

/**
 * 按组织或操作员/展商员工身份解析展位。
 * 传入 eventId 时只解析该活动下的展位，禁止回落到其它活动。
 */
export async function resolveExhibitorBoothForUser(
  userId: string,
  orgId: string,
  eventId?: string | null,
): Promise<ExhibitorBoothContext | null> {
  const byOrg = await resolveExhibitorBooth(orgId, eventId);
  if (byOrg) return byOrg;

  const participantContactOr = await buildParticipantContactOrForUser(userId);

  const booth = await prisma.exhibitorBooth.findFirst({
    where: {
      ...(eventId ? { eventId } : {}),
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
        ...(participantContactOr
          ? [
              {
                participants: {
                  some: {
                    OR: participantContactOr,
                    systemRole: SystemRole.EXHIBITOR,
                    ...(eventId ? { eventId } : {}),
                  },
                },
              },
            ]
          : []),
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

export async function requireExhibitorAdmin(
  request?: Request,
  options?: { eventId?: string | null },
): Promise<{
  session?: Session;
  userId?: string;
  orgId: string;
  booth: ExhibitorBoothContext;
}> {
  const eventId = options?.eventId?.trim() || null;
  const missingMsg = eventId
    ? "未找到该活动下的关联展位"
    : "未找到关联展位";
  const missingCode = eventId ? ErrorCode.NOT_FOUND : ErrorCode.FORBIDDEN;
  const missingStatus = eventId ? 404 : 403;

  const sessionResult = await requireAccountAdmin();
  if (!("error" in sessionResult)) {
    const { session, orgId } = sessionResult;
    const booth = await resolveExhibitorBoothForUser(
      session.user.id,
      orgId,
      eventId,
    );
    if (!booth) {
      throw new ApiError(missingMsg, missingCode, missingStatus);
    }
    return { session, orgId, booth };
  }

  if (!request) {
    throw new ApiError("无权访问", ErrorCode.FORBIDDEN, 403);
  }

  const { userId, orgId } = await requireMobileAccountAdmin(request);
  const booth = await resolveExhibitorBoothForUser(userId, orgId, eventId);
  if (!booth) {
    throw new ApiError(missingMsg, missingCode, missingStatus);
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
