import { prisma } from "@connectiq/database";
import { ErrorCode } from "@connectiq/types";
import type { Session } from "next-auth";
import { ApiError, requireAccountAdmin } from "@/lib/api-auth";

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

export async function requireExhibitorAdmin(): Promise<{
  session: Session;
  orgId: string;
  booth: ExhibitorBoothContext;
}> {
  const result = await requireAccountAdmin();
  if ("error" in result) {
    throw new ApiError("无权访问", ErrorCode.FORBIDDEN, 403);
  }

  const { session, orgId } = result;

  const booth = await resolveExhibitorBooth(orgId);
  if (!booth) {
    throw new ApiError("未找到关联展位", ErrorCode.NOT_FOUND, 404);
  }

  return { session, orgId, booth };
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
