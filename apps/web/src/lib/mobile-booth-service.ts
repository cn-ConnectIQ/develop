import {
  InviteStatus,
  LotteryStatus,
  OrgStaffRole,
  StampRallyStatus,
  prisma,
} from "@connectiq/database";
import { ErrorCode } from "@connectiq/types";
import { ApiError } from "@/lib/api-auth";

export type ApiBoothStaffMember = {
  user_id: string;
  name: string;
  title: string | null;
  company: string;
  avatar_url: string | null;
};

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
  staff: ApiBoothStaffMember[];
  contact_user_id: string | null;
  contact_name: string | null;
  contact_title: string | null;
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

const PUBLIC_STAFF_ROLES: OrgStaffRole[] = [
  OrgStaffRole.OWNER,
  OrgStaffRole.ADMIN,
  OrgStaffRole.OPERATOR,
];

const staffUserSelect = {
  id: true,
  name: true,
  profile: { select: { company: true, valueProposition: true } },
} as const;

type StaffUser = {
  id: string;
  name: string;
  profile: { company: string | null; valueProposition: string | null } | null;
};

type BoothStaffSource = {
  companyOrg: { name: string; logoUrl: string | null; owner: StaffUser | null; staff: Array<{ role: OrgStaffRole; status: InviteStatus; user: StaffUser }> };
  operator: StaffUser | null;
};

function mapStaffUser(user: StaffUser, companyName: string): ApiBoothStaffMember {
  return {
    user_id: user.id,
    name: user.name,
    title: user.profile?.valueProposition ?? null,
    company: user.profile?.company ?? companyName,
    avatar_url: null,
  };
}

export function resolveBoothStaffMembers(booth: BoothStaffSource): ApiBoothStaffMember[] {
  const companyName = booth.companyOrg.name;
  const seen = new Set<string>();
  const members: ApiBoothStaffMember[] = [];

  const push = (user: StaffUser | null | undefined) => {
    if (!user || seen.has(user.id)) return;
    seen.add(user.id);
    members.push(mapStaffUser(user, companyName));
  };

  push(booth.operator);
  push(booth.companyOrg.owner);
  for (const row of booth.companyOrg.staff) {
    if (row.status !== InviteStatus.ACCEPTED) continue;
    if (!PUBLIC_STAFF_ROLES.includes(row.role)) continue;
    push(row.user);
  }

  return members;
}

function attachStaffFields(
  booth: BoothStaffSource,
  base: Omit<ApiPublicBoothItem, "staff" | "contact_user_id" | "contact_name" | "contact_title">,
): ApiPublicBoothItem {
  const staff = resolveBoothStaffMembers(booth);
  const primary = staff[0];
  return {
    ...base,
    staff,
    contact_user_id: primary?.user_id ?? null,
    contact_name: primary?.name ?? null,
    contact_title: primary?.title ?? null,
  };
}

const boothStaffInclude = {
  operator: { select: staffUserSelect },
  companyOrg: {
    select: {
      name: true,
      logoUrl: true,
      bio: true,
      owner: { select: staffUserSelect },
      staff: {
        where: { status: InviteStatus.ACCEPTED, role: { in: PUBLIC_STAFF_ROLES } },
        select: {
          role: true,
          status: true,
          user: { select: staffUserSelect },
        },
      },
    },
  },
} as const;

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

type BoothRow = BoothStaffSource & {
  id: string;
  name: string;
  code: string;
  hallLabel: string | null;
  status: string;
};

function mapPublicBoothFields(
  booth: BoothRow,
  flags: BoothInteractionFlags,
): ApiPublicBoothItem {
  const lotteryId = flags.lotteryByBoothId.get(booth.id) ?? null;
  const stampEnabled = flags.stampBoothIds.has(booth.id);

  return attachStaffFields(booth, {
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
  });
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
      include: boothStaffInclude,
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
      ...boothStaffInclude,
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
