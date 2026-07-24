import {
  InviteStatus,
  LotteryStatus,
  OrgStaffRole,
  StampRallyStatus,
  SystemRole,
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
  companyOrg: {
    name: string;
    logoUrl: string | null;
    owner: StaffUser | null;
    staff: Array<{ role: OrgStaffRole; status: InviteStatus; user: StaffUser }>;
  };
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

function mergeBoothStaffLists(
  preferred: ApiBoothStaffMember[],
  fallback: ApiBoothStaffMember[],
): ApiBoothStaffMember[] {
  const seen = new Set<string>();
  const members: ApiBoothStaffMember[] = [];
  for (const member of [...preferred, ...fallback]) {
    if (!member.user_id || seen.has(member.user_id)) continue;
    seen.add(member.user_id);
    members.push(member);
  }
  return members;
}

function withPrimaryContact(item: ApiPublicBoothItem): ApiPublicBoothItem {
  const primary = item.staff[0];
  return {
    ...item,
    contact_user_id: primary?.user_id ?? null,
    contact_name: primary?.name ?? null,
    contact_title: primary?.title ?? null,
  };
}

/**
 * 展位「添加工作人员」写入的是 Participant(EXHIBITOR+boothId)，
 * 与 OrgStaff 不同；公开详情必须合并，否则「与展商连接」为空。
 */
async function loadBoothTeamStaffByBoothIds(
  boothIds: string[],
  companyByBoothId: Map<string, string>,
): Promise<Map<string, ApiBoothStaffMember[]>> {
  const result = new Map<string, ApiBoothStaffMember[]>();
  if (boothIds.length === 0) return result;

  const participants = await prisma.participant.findMany({
    where: {
      boothId: { in: boothIds },
      systemRole: SystemRole.EXHIBITOR,
    },
    select: {
      boothId: true,
      name: true,
      phone: true,
      jobTitle: true,
      isBoothOwner: true,
      createdAt: true,
    },
    orderBy: [{ isBoothOwner: "desc" }, { createdAt: "asc" }],
  });

  const phones = [
    ...new Set(
      participants
        .map((row) => row.phone?.trim())
        .filter((phone): phone is string => Boolean(phone)),
    ),
  ];
  if (phones.length === 0) return result;

  const usersWithPhone = await prisma.user.findMany({
    where: { phone: { in: phones } },
    select: {
      id: true,
      name: true,
      phone: true,
      profile: { select: { company: true, valueProposition: true } },
    },
  });
  const userByPhone = new Map(
    usersWithPhone
      .filter((u) => u.phone)
      .map((u) => [u.phone as string, u] as const),
  );

  for (const row of participants) {
    if (!row.boothId || !row.phone) continue;
    const user = userByPhone.get(row.phone.trim());
    if (!user) continue;
    const company =
      user.profile?.company?.trim() ||
      companyByBoothId.get(row.boothId) ||
      "";
    const list = result.get(row.boothId) ?? [];
    if (list.some((m) => m.user_id === user.id)) continue;
    list.push({
      user_id: user.id,
      name: row.name?.trim() || user.name,
      title: row.jobTitle?.trim() || user.profile?.valueProposition || null,
      company,
      avatar_url: null,
    });
    result.set(row.boothId, list);
  }

  return result;
}

async function attachBoothTeamStaff(
  items: ApiPublicBoothItem[],
): Promise<ApiPublicBoothItem[]> {
  if (items.length === 0) return items;
  const companyByBoothId = new Map(
    items.map((item) => [item.id, item.company_name || item.company] as const),
  );
  const teamMap = await loadBoothTeamStaffByBoothIds(
    items.map((item) => item.id),
    companyByBoothId,
  );

  return items.map((item) => {
    const team = teamMap.get(item.id) ?? [];
    if (team.length === 0) return item;
    return withPrimaryContact({
      ...item,
      // 优先展示展位团队（主办/展商显式添加的工作人员）
      staff: mergeBoothStaffLists(team, item.staff),
    });
  });
}

function attachStaffFields(
  booth: BoothStaffSource,
  base: Omit<
    ApiPublicBoothItem,
    "staff" | "contact_user_id" | "contact_name" | "contact_title"
  >,
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

  const items = booths.map((booth) => mapPublicBoothFields(booth, flags));
  return attachBoothTeamStaff(items);
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
  const [base] = await attachBoothTeamStaff([mapPublicBoothFields(booth, flags)]);

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
