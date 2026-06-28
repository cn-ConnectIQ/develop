import {
  FeedItemType,
  StampRallyStatus,
  prisma,
} from "@connectiq/database";
import { ErrorCode } from "@connectiq/types";
import { ApiError } from "@/lib/api-auth";

export type ApiStampRally = {
  id: string;
  name: string;
  description: string | null;
  prize: string;
  prize_image_url: string | null;
  required_count: number;
  total_booths: number;
  booth_ids: string[];
  starts_at: string | null;
  ends_at: string | null;
  status: StampRallyStatus;
  participant_count: number;
  completed_count: number;
  created_at: string;
};

export type StampResult = {
  stamped: boolean;
  count: number;
  total: number;
  completed: boolean;
  already_stamped?: boolean;
};

function mapRallyRow(
  row: {
    id: string;
    name: string;
    description: string | null;
    prize: string;
    prizeImageUrl: string | null;
    requiredCount: number;
    totalBooths: number;
    boothIds: string[];
    startsAt: Date | null;
    endsAt: Date | null;
    status: StampRallyStatus;
    createdAt: Date;
    _count: { records: number; winners: number };
  },
): ApiStampRally {
  const participantGroups = row._count.records;
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    prize: row.prize,
    prize_image_url: row.prizeImageUrl,
    required_count: row.requiredCount,
    total_booths: row.totalBooths,
    booth_ids: row.boothIds,
    starts_at: row.startsAt?.toISOString() ?? null,
    ends_at: row.endsAt?.toISOString() ?? null,
    status: row.status,
    participant_count: participantGroups,
    completed_count: row._count.winners,
    created_at: row.createdAt.toISOString(),
  };
}

const rallyInclude = {
  _count: {
    select: {
      records: true,
      winners: true,
    },
  },
} as const;

async function validateBoothIds(eventId: string, boothIds: string[]) {
  if (boothIds.length === 0) {
    throw new ApiError("请至少选择一个参与展位", ErrorCode.VALIDATION_ERROR, 400);
  }

  const booths = await prisma.exhibitorBooth.findMany({
    where: { eventId, id: { in: boothIds } },
    select: { id: true },
  });

  if (booths.length !== boothIds.length) {
    throw new ApiError("部分展位不属于本活动", ErrorCode.VALIDATION_ERROR, 400);
  }
}

function assertRallySchedule(rally: {
  status: StampRallyStatus;
  startsAt: Date | null;
  endsAt: Date | null;
}) {
  if (rally.status !== StampRallyStatus.ACTIVE) {
    throw new ApiError("集章活动未开始或已结束", ErrorCode.VALIDATION_ERROR, 400);
  }

  const now = new Date();
  if (rally.startsAt && rally.startsAt > now) {
    throw new ApiError("集章活动尚未开始", ErrorCode.VALIDATION_ERROR, 400);
  }
  if (rally.endsAt && rally.endsAt < now) {
    throw new ApiError("集章活动已结束", ErrorCode.VALIDATION_ERROR, 400);
  }
}

export async function listStampRallies(eventId: string) {
  const rows = await prisma.stampRally.findMany({
    where: { eventId },
    orderBy: { createdAt: "desc" },
    include: rallyInclude,
  });

  const distinctUsers = await prisma.stampRecord.findMany({
    where: { rally: { eventId } },
    select: { rallyId: true, userId: true },
    distinct: ["rallyId", "userId"],
  });

  const participantMap = new Map<string, number>();
  for (const row of distinctUsers) {
    participantMap.set(row.rallyId, (participantMap.get(row.rallyId) ?? 0) + 1);
  }

  return rows.map((row) => ({
    ...mapRallyRow(row),
    participant_count: participantMap.get(row.id) ?? 0,
  }));
}

export async function createStampRally(
  eventId: string,
  createdById: string,
  input: {
    name: string;
    description?: string | null;
    prize: string;
    prize_image_url?: string | null;
    required_count: number;
    booth_ids: string[];
    starts_at?: string | null;
    ends_at?: string | null;
    status?: StampRallyStatus;
  },
) {
  await validateBoothIds(eventId, input.booth_ids);

  if (input.required_count < 1 || input.required_count > input.booth_ids.length) {
    throw new ApiError(
      "所需章数必须在 1 到参与展位数之间",
      ErrorCode.VALIDATION_ERROR,
      400,
    );
  }

  const row = await prisma.stampRally.create({
    data: {
      eventId,
      createdById,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      prize: input.prize.trim(),
      prizeImageUrl: input.prize_image_url ?? null,
      requiredCount: input.required_count,
      totalBooths: input.booth_ids.length,
      boothIds: input.booth_ids,
      startsAt: input.starts_at ? new Date(input.starts_at) : null,
      endsAt: input.ends_at ? new Date(input.ends_at) : null,
      status: input.status ?? StampRallyStatus.DRAFT,
    },
    include: rallyInclude,
  });

  return mapRallyRow({ ...row, _count: { records: 0, winners: 0 } });
}

export async function getStampRally(eventId: string, rallyId: string) {
  const row = await prisma.stampRally.findFirst({
    where: { id: rallyId, eventId },
    include: rallyInclude,
  });
  if (!row) return null;

  const distinctCount = await prisma.stampRecord.findMany({
    where: { rallyId },
    select: { userId: true },
    distinct: ["userId"],
  });

  return {
    ...mapRallyRow(row),
    participant_count: distinctCount.length,
  };
}

export async function updateStampRally(
  eventId: string,
  rallyId: string,
  input: Partial<{
    name: string;
    description: string | null;
    prize: string;
    prize_image_url: string | null;
    required_count: number;
    booth_ids: string[];
    starts_at: string | null;
    ends_at: string | null;
    status: StampRallyStatus;
  }>,
) {
  const existing = await prisma.stampRally.findFirst({
    where: { id: rallyId, eventId },
  });
  if (!existing) {
    throw new ApiError("集章路线不存在", ErrorCode.NOT_FOUND, 404);
  }

  const boothIds = input.booth_ids ?? existing.boothIds;
  if (input.booth_ids) {
    await validateBoothIds(eventId, boothIds);
  }

  const requiredCount = input.required_count ?? existing.requiredCount;
  if (requiredCount < 1 || requiredCount > boothIds.length) {
    throw new ApiError(
      "所需章数必须在 1 到参与展位数之间",
      ErrorCode.VALIDATION_ERROR,
      400,
    );
  }

  const row = await prisma.stampRally.update({
    where: { id: rallyId },
    data: {
      name: input.name?.trim(),
      description: input.description?.trim() ?? undefined,
      prize: input.prize?.trim(),
      prizeImageUrl: input.prize_image_url,
      requiredCount,
      totalBooths: boothIds.length,
      boothIds,
      startsAt:
        input.starts_at !== undefined
          ? input.starts_at
            ? new Date(input.starts_at)
            : null
          : undefined,
      endsAt:
        input.ends_at !== undefined
          ? input.ends_at
            ? new Date(input.ends_at)
            : null
          : undefined,
      status: input.status,
    },
    include: rallyInclude,
  });

  const distinctCount = await prisma.stampRecord.findMany({
    where: { rallyId },
    select: { userId: true },
    distinct: ["userId"],
  });

  return {
    ...mapRallyRow(row),
    participant_count: distinctCount.length,
  };
}

export async function stampBooth(
  eventId: string,
  rallyId: string,
  userId: string,
  boothId: string,
): Promise<StampResult> {
  const rally = await prisma.stampRally.findFirst({
    where: { id: rallyId, eventId },
  });
  if (!rally) {
    throw new ApiError("集章路线不存在", ErrorCode.NOT_FOUND, 404);
  }

  assertRallySchedule(rally);

  if (!rally.boothIds.includes(boothId)) {
    throw new ApiError("该展位不在集章路线中", ErrorCode.VALIDATION_ERROR, 400);
  }

  const existing = await prisma.stampRecord.findUnique({
    where: {
      rallyId_userId_boothId: { rallyId, userId, boothId },
    },
  });

  if (existing) {
    const count = await prisma.stampRecord.count({
      where: { rallyId, userId },
    });
    const winner = await prisma.stampRallyWinner.findUnique({
      where: { rallyId_userId: { rallyId, userId } },
    });
    return {
      stamped: false,
      already_stamped: true,
      count,
      total: rally.requiredCount,
      completed: Boolean(winner),
    };
  }

  await prisma.stampRecord.create({
    data: { rallyId, userId, boothId },
  });

  const count = await prisma.stampRecord.count({
    where: { rallyId, userId },
  });

  let completed = false;
  if (count >= rally.requiredCount) {
    const existingWinner = await prisma.stampRallyWinner.findUnique({
      where: { rallyId_userId: { rallyId, userId } },
    });

    if (!existingWinner) {
      await prisma.stampRallyWinner.create({
        data: { rallyId, userId },
      });

      await prisma.notification.create({
        data: {
          userId,
          title: "集章完成！",
          body: `恭喜完成「${rally.name}」，可兑换：${rally.prize}`,
        },
      });

      await prisma.feedItem.create({
        data: {
          userId,
          eventId,
          type: FeedItemType.SYSTEM,
          triggerReason: "集章打卡完成",
          content: JSON.stringify({
            rally_id: rally.id,
            rally_name: rally.name,
            prize: rally.prize,
            prize_image_url: rally.prizeImageUrl,
          }),
        },
      });
    }

    completed = true;
  }

  return {
    stamped: true,
    count,
    total: rally.requiredCount,
    completed,
  };
}

export async function getMyStampProgress(
  eventId: string,
  rallyId: string,
  userId: string,
) {
  const rally = await prisma.stampRally.findFirst({
    where: { id: rallyId, eventId },
  });
  if (!rally) {
    throw new ApiError("集章路线不存在", ErrorCode.NOT_FOUND, 404);
  }

  const records = await prisma.stampRecord.findMany({
    where: { rallyId, userId },
    orderBy: { stampedAt: "asc" },
    include: {
      booth: {
        select: {
          id: true,
          code: true,
          companyOrg: { select: { name: true } },
        },
      },
    },
  });

  const winner = await prisma.stampRallyWinner.findUnique({
    where: { rallyId_userId: { rallyId, userId } },
  });

  return {
    stamps: records.map((r) => ({
      booth_id: r.boothId,
      booth_number: r.booth.code,
      company_name: r.booth.companyOrg.name,
      stamped_at: r.stampedAt.toISOString(),
    })),
    count: records.length,
    total: rally.requiredCount,
    completed: Boolean(winner),
    redeemed: winner?.redeemed ?? false,
  };
}

/** 小程序 stamp-passport 契约（无需客户端事先知道 rallyId） */
export type ApiStampPassport = {
  event_id: string;
  rally_id: string;
  required_count: number;
  stamped_booth_ids: string[];
  stamped_count: number;
  reward_title: string;
  reward_description: string | null;
  reward_claimed: boolean;
  completed: boolean;
};

async function findActiveStampRallyForEvent(eventId: string) {
  return prisma.stampRally.findFirst({
    where: { eventId, status: StampRallyStatus.ACTIVE },
    orderBy: { createdAt: "desc" },
  });
}

export async function getStampPassportForEvent(
  eventId: string,
  userId: string,
): Promise<ApiStampPassport> {
  const rally = await findActiveStampRallyForEvent(eventId);
  if (!rally) {
    throw new ApiError("暂无进行中的集章活动", ErrorCode.NOT_FOUND, 404);
  }

  const progress = await getMyStampProgress(eventId, rally.id, userId);

  return {
    event_id: eventId,
    rally_id: rally.id,
    required_count: progress.total,
    stamped_booth_ids: progress.stamps.map((s) => s.booth_id),
    stamped_count: progress.count,
    reward_title: rally.prize,
    reward_description: rally.description,
    reward_claimed: progress.redeemed,
    completed: progress.completed,
  };
}

/** 按展位打卡（自动匹配 ACTIVE 集章路线，供 /booths/{boothId}/stamp） */
export async function stampAtEventBooth(
  eventId: string,
  userId: string,
  boothId: string,
): Promise<ApiStampPassport> {
  const rally = await prisma.stampRally.findFirst({
    where: {
      eventId,
      status: StampRallyStatus.ACTIVE,
      boothIds: { has: boothId },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!rally) {
    throw new ApiError("该展位暂无集章活动", ErrorCode.NOT_FOUND, 404);
  }

  await stampBooth(eventId, rally.id, userId, boothId);
  return getStampPassportForEvent(eventId, userId);
}

export async function listEventBoothsForRally(eventId: string) {
  return prisma.exhibitorBooth.findMany({
    where: { eventId },
    select: {
      id: true,
      code: true,
      name: true,
      companyOrg: { select: { id: true, name: true } },
    },
    orderBy: { code: "asc" },
  });
}

/** 展位扫码时自动尝试集章（所有进行中的相关路线） */
export async function stampBoothForActiveRallies(
  eventId: string,
  userId: string,
  boothId: string,
) {
  const rallies = await prisma.stampRally.findMany({
    where: {
      eventId,
      status: StampRallyStatus.ACTIVE,
      boothIds: { has: boothId },
    },
    select: { id: true },
  });

  for (const rally of rallies) {
    try {
      await stampBooth(eventId, rally.id, userId, boothId);
    } catch {
      // 单条路线失败不影响其他
    }
  }
}

export type ApiStampRallyWinner = {
  id: string;
  user_id: string;
  user_name: string;
  user_company: string | null;
  completed_at: string;
  redeemed: boolean;
  stamp_count: number;
};

export async function listStampRallyWinners(eventId: string, rallyId: string) {
  const rally = await prisma.stampRally.findFirst({
    where: { id: rallyId, eventId },
  });
  if (!rally) {
    throw new ApiError("集章路线不存在", ErrorCode.NOT_FOUND, 404);
  }

  const winners = await prisma.stampRallyWinner.findMany({
    where: { rallyId },
    orderBy: { completedAt: "desc" },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          profile: { select: { company: true } },
        },
      },
    },
  });

  const stampCounts = await prisma.stampRecord.groupBy({
    by: ["userId"],
    where: { rallyId },
    _count: { id: true },
  });
  const countMap = new Map(stampCounts.map((r) => [r.userId, r._count.id]));

  return winners.map((w): ApiStampRallyWinner => ({
    id: w.id,
    user_id: w.userId,
    user_name: w.user.name,
    user_company: w.user.profile?.company ?? null,
    completed_at: w.completedAt.toISOString(),
    redeemed: w.redeemed,
    stamp_count: countMap.get(w.userId) ?? rally.requiredCount,
  }));
}

export async function redeemStampRallyWinner(
  eventId: string,
  rallyId: string,
  winnerId: string,
  redeemed: boolean,
) {
  const winner = await prisma.stampRallyWinner.findFirst({
    where: { id: winnerId, rallyId, rally: { eventId } },
  });
  if (!winner) {
    throw new ApiError("完成记录不存在", ErrorCode.NOT_FOUND, 404);
  }

  return prisma.stampRallyWinner.update({
    where: { id: winnerId },
    data: { redeemed },
  });
}

export async function listRallyParticipantProgress(
  eventId: string,
  rallyId: string,
) {
  const rally = await prisma.stampRally.findFirst({
    where: { id: rallyId, eventId },
  });
  if (!rally) {
    throw new ApiError("集章路线不存在", ErrorCode.NOT_FOUND, 404);
  }

  const records = await prisma.stampRecord.groupBy({
    by: ["userId"],
    where: { rallyId },
    _count: { boothId: true },
    _max: { stampedAt: true },
  });

  const userIds = records.map((r) => r.userId);
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: {
      id: true,
      name: true,
      profile: { select: { company: true } },
    },
  });
  const userMap = new Map(users.map((u) => [u.id, u]));

  const winners = await prisma.stampRallyWinner.findMany({
    where: { rallyId },
    select: { userId: true, redeemed: true, completedAt: true },
  });
  const winnerMap = new Map(winners.map((w) => [w.userId, w]));

  return records
    .map((r) => {
      const user = userMap.get(r.userId);
      const winner = winnerMap.get(r.userId);
      return {
        user_id: r.userId,
        user_name: user?.name ?? "未知用户",
        user_company: user?.profile?.company ?? null,
        stamp_count: r._count.boothId,
        required_count: rally.requiredCount,
        completed: Boolean(winner),
        redeemed: winner?.redeemed ?? false,
        last_stamped_at: r._max.stampedAt?.toISOString() ?? null,
        completed_at: winner?.completedAt?.toISOString() ?? null,
      };
    })
    .sort((a, b) => b.stamp_count - a.stamp_count);
}
