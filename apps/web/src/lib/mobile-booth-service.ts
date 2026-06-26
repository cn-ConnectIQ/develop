import { prisma } from "@connectiq/database";
import { ErrorCode } from "@connectiq/types";
import { ApiError } from "@/lib/api-auth";

export type ApiPublicBoothItem = {
  id: string;
  name: string;
  code: string;
  company: string;
  hallLabel: string | null;
  status: string;
  logo: string | null;
};

export type ApiBoothDetail = {
  id: string;
  name: string;
  code: string;
  company: string;
  hallLabel: string | null;
  status: string;
  description: string | null;
  eventId: string;
  eventName: string;
  org: { name: string; logoUrl: string | null };
};

export async function listPublicEventBooths(
  eventId: string,
): Promise<ApiPublicBoothItem[]> {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true },
  });
  if (!event) {
    throw new ApiError("活动不存在", ErrorCode.NOT_FOUND, 404);
  }

  const booths = await prisma.exhibitorBooth.findMany({
    where: { eventId },
    include: {
      companyOrg: { select: { name: true, logoUrl: true } },
    },
    orderBy: { code: "asc" },
  });

  return booths.map((booth) => ({
    id: booth.id,
    name: booth.name,
    code: booth.code,
    company: booth.companyOrg.name,
    hallLabel: booth.hallLabel,
    status: booth.status,
    logo: booth.companyOrg.logoUrl,
  }));
}

export async function getPublicBoothDetail(
  boothId: string,
): Promise<ApiBoothDetail> {
  const booth = await prisma.exhibitorBooth.findUnique({
    where: { id: boothId },
    include: {
      companyOrg: { select: { name: true, logoUrl: true, bio: true } },
      event: { select: { id: true, name: true, description: true } },
    },
  });
  if (!booth) {
    throw new ApiError("展位不存在", ErrorCode.NOT_FOUND, 404);
  }

  return {
    id: booth.id,
    name: booth.name,
    code: booth.code,
    company: booth.companyOrg.name,
    hallLabel: booth.hallLabel,
    status: booth.status,
    description: booth.companyOrg.bio ?? booth.event.description,
    eventId: booth.event.id,
    eventName: booth.event.name,
    org: {
      name: booth.companyOrg.name,
      logoUrl: booth.companyOrg.logoUrl,
    },
  };
}
