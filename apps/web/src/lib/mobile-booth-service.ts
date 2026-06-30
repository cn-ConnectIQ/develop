import { LotteryStatus, StampRallyStatus, prisma } from "@connectiq/database";
import { ErrorCode } from "@connectiq/types";
import { ApiError } from "@/lib/api-auth";

export type ApiPublicBoothItem = {
  id: string;
  name: string;
  code: string;
  company: string;
  company_name: string;
  booth_code: string;
  hallLabel: string | null;
  hall: string | null;
  status: string;
  logo: string | null;
  logo_url: string | null;
  stamp_enabled: boolean;
  stampEnabled: boolean;
  has_lottery: boolean;
  hasLottery: boolean;
  lottery_id: string | null;
  lotteryId: string | null;
};

export type ApiBoothDetail = ApiPublicBoothItem & {
  description: string | null;
  eventId: string;
  eventName: string;
  org: { name: string; logoUrl: string | null };
};

type BoothInteractionFlags = {
  stampBoothIds: Set<string>;
  lotteryByBoothId: Map<string, string>;
};

async function loadBoothInteractionFlags(
  eventId: string,
): Promise<BoothInteractionFlags> {
  const [rally, lotteries] = await Promise.all([
    prisma.stampRally.findFirst({
      where: { eventId, status: StampRallyStatus.ACTIVE },
      orderBy: { createdAt: "desc" },
      select: { boothIds: true },
    }),
    prisma.lottery.findMany({
      where: {
        eventId,
        boothId: { not: null },
        status: LotteryStatus.OPEN,
      },
      orderBy: { updatedAt: "desc" },
      select: { id: true, boothId: true },
    }),
  ]);

  const lotteryByBoothId = new Map<string, string>();
  for (const row of lotteries) {
    if (row.boothId && !lotteryByBoothId.has(row.boothId)) {
      lotteryByBoothId.set(row.boothId, row.id);
    }
  }

  return {
    stampBoothIds: new Set(rally?.boothIds ?? []),
    lotteryByBoothId,
  };
}

type BoothRow = {
  id: string;
  name: string;
  code: string;
  hallLabel: string | null;
  status: string;
  companyOrg: { name: string; logoUrl: string | null };
};

function mapPublicBoothFields(
  booth: BoothRow,
  flags: BoothInteractionFlags,
): ApiPublicBoothItem {
  const lotteryId = flags.lotteryByBoothId.get(booth.id) ?? null;
  const stampEnabled = flags.stampBoothIds.has(booth.id);

  return {
    id: booth.id,
    name: booth.name,
    code: booth.code,
    company: booth.companyOrg.name,
    company_name: booth.companyOrg.name,
    booth_code: booth.code,
    hallLabel: booth.hallLabel,
    hall: booth.hallLabel,
    status: booth.status,
    logo: booth.companyOrg.logoUrl,
    logo_url: booth.companyOrg.logoUrl,
    stamp_enabled: stampEnabled,
    stampEnabled,
    has_lottery: Boolean(lotteryId),
    hasLottery: Boolean(lotteryId),
    lottery_id: lotteryId,
    lotteryId,
  };
}

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

  const [booths, flags] = await Promise.all([
    prisma.exhibitorBooth.findMany({
      where: { eventId },
      include: {
        companyOrg: { select: { name: true, logoUrl: true } },
      },
      orderBy: { code: "asc" },
    }),
    loadBoothInteractionFlags(eventId),
  ]);

  return booths.map((booth) => mapPublicBoothFields(booth, flags));
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

  const flags = await loadBoothInteractionFlags(booth.eventId);
  const base = mapPublicBoothFields(booth, flags);

  return {
    ...base,
    description: booth.companyOrg.bio ?? booth.event.description,
    eventId: booth.event.id,
    eventName: booth.event.name,
    org: {
      name: booth.companyOrg.name,
      logoUrl: booth.companyOrg.logoUrl,
    },
  };
}
