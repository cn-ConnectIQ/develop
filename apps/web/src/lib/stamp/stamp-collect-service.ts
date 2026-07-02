import {
  FeedItemType,
  StampCollectMethod,
  StampRallyStatus,
  prisma,
} from "@connectiq/database";
import { ErrorCode } from "@connectiq/types";
import { ApiError } from "@/lib/api-auth";
import { loadStampRallyMeta } from "@/lib/stamp/stamp-rally-organizer-service";
import { stampBooth } from "@/lib/stamp-rally-service";

function generateRedemptionCode(userId: string): string {
  const tail = userId.replace(/[^a-zA-Z0-9]/g, "").slice(-6).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `STAMP-${tail || "CIQ"}-${rand}`;
}

export type AttendeeStampSlot = {
  stamp_id: string | null;
  booth_id: string;
  booth_number: string;
  company_name: string;
  stamp_name: string;
  icon: string | null;
  stamped: boolean;
  stamped_at: string | null;
};

export type AttendeeStampRallyProgress = {
  event_id: string;
  rally_id: string;
  rally_name: string;
  prize: string;
  prize_image_url: string | null;
  prize_description: string | null;
  redemption_location: string | null;
  required_count: number;
  stamped_count: number;
  remaining: number;
  completed: boolean;
  redeemed: boolean;
  redemption_code: string | null;
  booths: AttendeeStampSlot[];
};

async function findRally(eventId: string, rallyId?: string) {
  if (rallyId) {
    return prisma.stampRally.findFirst({ where: { id: rallyId, eventId } });
  }
  return prisma.stampRally.findFirst({
    where: { eventId, status: StampRallyStatus.ACTIVE },
    orderBy: { createdAt: "desc" },
  });
}

function assertRallyActive(rally: {
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

async function buildStampSlots(
  eventId: string,
  rallyId: string,
  boothIds: string[],
  userId: string,
): Promise<AttendeeStampSlot[]> {
  const [meta, stampRows, records, userStamps, booths] = await Promise.all([
    loadStampRallyMeta(eventId, rallyId),
    prisma.stamp.findMany({
      where: { rallyId },
      orderBy: { sortOrder: "asc" },
      include: {
        booth: {
          select: {
            id: true,
            code: true,
            companyOrg: { select: { name: true } },
          },
        },
      },
    }),
    prisma.stampRecord.findMany({
      where: { rallyId, userId },
      select: { boothId: true, stampedAt: true },
    }),
    prisma.userStamp.findMany({
      where: { userId, stamp: { rallyId } },
      select: { stampId: true, collectedAt: true, stamp: { select: { boothId: true } } },
    }),
    prisma.exhibitorBooth.findMany({
      where: { eventId, id: { in: boothIds } },
      select: {
        id: true,
        code: true,
        companyOrg: { select: { name: true } },
      },
    }),
  ]);

  const recordMap = new Map(records.map((r) => [r.boothId, r.stampedAt.toISOString()]));
  const userStampByStampId = new Map(
    userStamps.map((u) => [u.stampId, u.collectedAt.toISOString()]),
  );
  const userStampMap = new Map(
    userStamps
      .filter((u) => u.stamp.boothId)
      .map((u) => [u.stamp.boothId!, u.collectedAt.toISOString()]),
  );

  if (stampRows.length > 0) {
    return stampRows.map((row) => {
      const boothId = row.boothId ?? "";
      const booth = row.booth ?? booths.find((b) => b.id === boothId);
      const cfg = meta.booth_stamps.find((s) => s.booth_id === boothId);
      const stamped =
        userStampByStampId.has(row.id) ||
        (boothId ? recordMap.has(boothId) || userStampMap.has(boothId) : false);
      const stampedAt =
        userStampByStampId.get(row.id) ??
        (boothId ? userStampMap.get(boothId) ?? recordMap.get(boothId) : null) ??
        null;
      return {
        stamp_id: row.id,
        booth_id: boothId,
        booth_number: booth?.code ?? boothId.slice(-4),
        company_name: booth?.companyOrg.name ?? cfg?.name ?? "展位",
        stamp_name: row.name || cfg?.name || booth?.code || "章印",
        icon: row.icon ?? cfg?.icon ?? null,
        stamped,
        stamped_at: stampedAt,
      };
    });
  }

  return boothIds.map((boothId) => {
    const booth = booths.find((b) => b.id === boothId);
    const cfg = meta.booth_stamps.find((s) => s.booth_id === boothId);
    const stamped = recordMap.has(boothId);
    return {
      stamp_id: null,
      booth_id: boothId,
      booth_number: booth?.code ?? boothId.slice(-4),
      company_name: booth?.companyOrg.name ?? cfg?.name ?? "展位",
      stamp_name: cfg?.name ?? booth?.code ?? "章印",
      icon: cfg?.icon ?? null,
      stamped,
      stamped_at: recordMap.get(boothId) ?? null,
    };
  });
}

export async function getAttendeeStampRallyProgress(
  eventId: string,
  userId: string,
  rallyId?: string,
): Promise<AttendeeStampRallyProgress> {
  const rally = await findRally(eventId, rallyId);
  if (!rally) {
    throw new ApiError("暂无进行中的集章活动", ErrorCode.NOT_FOUND, 404);
  }

  const booths = await buildStampSlots(eventId, rally.id, rally.boothIds, userId);
  const stamped_count = booths.filter((b) => b.stamped).length;

  const progress = await prisma.userStampProgress.findUnique({
    where: { userId_rallyId: { userId, rallyId: rally.id } },
  });

  const winner = await prisma.stampRallyWinner.findUnique({
    where: { rallyId_userId: { rallyId: rally.id, userId } },
  });

  const completed = Boolean(winner) || stamped_count >= rally.requiredCount;
  const remaining = Math.max(rally.requiredCount - stamped_count, 0);

  return {
    event_id: eventId,
    rally_id: rally.id,
    rally_name: rally.name,
    prize: rally.prize,
    prize_image_url: rally.prizeImageUrl,
    prize_description: rally.description,
    redemption_location: rally.description,
    required_count: rally.requiredCount,
    stamped_count,
    remaining,
    completed,
    redeemed: progress?.redeemed ?? winner?.redeemed ?? false,
    redemption_code: progress?.redemptionCode ?? null,
    booths,
  };
}

export async function verifyStampScanCode(stampId: string, code: string) {
  const stamp = await prisma.stamp.findUnique({
    where: { id: stampId },
    include: { rally: { select: { eventId: true, status: true } } },
  });
  if (!stamp) {
    throw new ApiError("章印不存在", ErrorCode.NOT_FOUND, 404);
  }
  const valid = stamp.scanCode === code.trim();
  return {
    valid,
    stamp_id: stamp.id,
    booth_id: stamp.boothId,
    event_id: stamp.rally.eventId,
    rally_id: stamp.rallyId,
  };
}

export type CollectStampResult = {
  collected: boolean;
  already_collected: boolean;
  stamp_id: string;
  booth_id: string | null;
  stamp_name: string;
  icon: string | null;
  stamped_count: number;
  required_count: number;
  remaining: number;
  completed: boolean;
  redemption_code: string | null;
  event_id: string;
  rally_id: string;
};

async function ensureUserStampProgress(
  userId: string,
  rallyId: string,
  requiredCount: number,
  stampedCount: number,
) {
  const completed = stampedCount >= requiredCount;
  const existing = await prisma.userStampProgress.findUnique({
    where: { userId_rallyId: { userId, rallyId } },
  });

  if (existing) {
    const redemptionCode =
      completed && !existing.redemptionCode
        ? generateRedemptionCode(userId)
        : existing.redemptionCode;

    return prisma.userStampProgress.update({
      where: { id: existing.id },
      data: {
        collectedCount: stampedCount,
        isCompleted: completed || existing.isCompleted,
        completedAt:
          completed && !existing.completedAt ? new Date() : existing.completedAt,
        redemptionCode: redemptionCode ?? existing.redemptionCode,
      },
    });
  }

  return prisma.userStampProgress.create({
    data: {
      userId,
      rallyId,
      collectedCount: stampedCount,
      isCompleted: completed,
      completedAt: completed ? new Date() : null,
      redemptionCode: completed ? generateRedemptionCode(userId) : null,
    },
  });
}

export async function collectStampById(
  stampId: string,
  userId: string,
  code?: string,
): Promise<CollectStampResult> {
  const stamp = await prisma.stamp.findUnique({
    where: { id: stampId },
    include: { rally: true },
  });
  if (!stamp) {
    throw new ApiError("章印不存在", ErrorCode.NOT_FOUND, 404);
  }

  assertRallyActive(stamp.rally);

  if (code && code.trim() !== stamp.scanCode) {
    throw new ApiError("章码无效", ErrorCode.VALIDATION_ERROR, 400);
  }

  const existingUserStamp = await prisma.userStamp.findUnique({
    where: { userId_stampId: { userId, stampId } },
  });

  let alreadyCollected = Boolean(existingUserStamp);

  if (stamp.boothId) {
    const record = await prisma.stampRecord.findUnique({
      where: {
        rallyId_userId_boothId: {
          rallyId: stamp.rallyId,
          userId,
          boothId: stamp.boothId,
        },
      },
    });
    if (record) alreadyCollected = true;

    if (!alreadyCollected && !existingUserStamp) {
      await stampBooth(stamp.rally.eventId, stamp.rallyId, userId, stamp.boothId);
    }
  } else if (existingUserStamp) {
    alreadyCollected = true;
  }

  if (!existingUserStamp) {
    await prisma.userStamp.create({
      data: {
        userId,
        stampId,
        collectMethod: StampCollectMethod.SCAN,
      },
    });
  }

  const progress = await getAttendeeStampRallyProgress(
    stamp.rally.eventId,
    userId,
    stamp.rallyId,
  );

  if (progress.completed && !progress.redeemed) {
    await ensureUserStampProgress(
      userId,
      stamp.rallyId,
      stamp.rally.requiredCount,
      progress.stamped_count,
    );

    const winner = await prisma.stampRallyWinner.findUnique({
      where: { rallyId_userId: { rallyId: stamp.rallyId, userId } },
    });
    if (!winner) {
      await prisma.stampRallyWinner.create({
        data: { rallyId: stamp.rallyId, userId },
      });
    }

    await prisma.feedItem.create({
      data: {
        userId,
        eventId: stamp.rally.eventId,
        type: FeedItemType.SYSTEM,
        triggerReason: "集章打卡完成",
        content: JSON.stringify({
          rally_id: stamp.rallyId,
          rally_name: stamp.rally.name,
          prize: stamp.rally.prize,
        }),
      },
    }).catch(() => {});
  } else {
    await ensureUserStampProgress(
      userId,
      stamp.rallyId,
      stamp.rally.requiredCount,
      progress.stamped_count,
    );
  }

  const refreshed = await getAttendeeStampRallyProgress(
    stamp.rally.eventId,
    userId,
    stamp.rallyId,
  );

  return {
    collected: !alreadyCollected,
    already_collected: alreadyCollected,
    stamp_id: stamp.id,
    booth_id: stamp.boothId,
    stamp_name: stamp.name,
    icon: stamp.icon,
    stamped_count: refreshed.stamped_count,
    required_count: refreshed.required_count,
    remaining: refreshed.remaining,
    completed: refreshed.completed,
    redemption_code: refreshed.redemption_code,
    event_id: stamp.rally.eventId,
    rally_id: stamp.rallyId,
  };
}
