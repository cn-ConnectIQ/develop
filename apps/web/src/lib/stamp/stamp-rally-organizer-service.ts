import { StampOwnerType, StampRallyStatus, prisma } from "@connectiq/database";
import type { Prisma } from "@connectiq/database";
import { ErrorCode } from "@connectiq/types";
import { ApiError } from "@/lib/api-auth";
import type {
  BoothStampConfig,
  StampRallyMeta,
} from "@/lib/stamp/stamp-rally-config";

export const stampRallyMetaKey = (rallyId: string) =>
  `stamp_rally_meta_${rallyId}`;

export async function loadStampRallyMeta(
  eventId: string,
  rallyId: string,
): Promise<StampRallyMeta> {
  const row = await prisma.eventSetting.findUnique({
    where: {
      eventId_key: { eventId, key: stampRallyMetaKey(rallyId) },
    },
  });

  if (!row?.value || typeof row.value !== "object" || Array.isArray(row.value)) {
    return { booth_stamps: [], prize_quantity: null };
  }

  const obj = row.value as Record<string, unknown>;
  const booth_stamps = Array.isArray(obj.booth_stamps)
    ? (obj.booth_stamps as BoothStampConfig[])
    : [];

  return {
    prize_quantity:
      typeof obj.prize_quantity === "number" ? obj.prize_quantity : null,
    booth_stamps,
  };
}

export async function saveStampRallyMeta(
  eventId: string,
  rallyId: string,
  meta: StampRallyMeta,
) {
  await prisma.eventSetting.upsert({
    where: {
      eventId_key: { eventId, key: stampRallyMetaKey(rallyId) },
    },
    create: {
      eventId,
      key: stampRallyMetaKey(rallyId),
      value: meta as Prisma.InputJsonValue,
    },
    update: {
      value: meta as Prisma.InputJsonValue,
    },
  });
}

export async function syncRallyStampRecords(
  rallyId: string,
  boothStamps: BoothStampConfig[],
) {
  const existing = await prisma.stamp.findMany({
    where: { rallyId },
    select: { id: true, boothId: true },
  });

  const boothIds = boothStamps.map((s) => s.booth_id);
  const removeIds = existing
    .filter((s) => s.boothId && !boothIds.includes(s.boothId))
    .map((s) => s.id);

  if (removeIds.length > 0) {
    await prisma.stamp.deleteMany({ where: { id: { in: removeIds } } });
  }

  for (const [index, cfg] of boothStamps.entries()) {
    const found = existing.find((s) => s.boothId === cfg.booth_id);
    if (found) {
      await prisma.stamp.update({
        where: { id: found.id },
        data: {
          name: cfg.name,
          icon: cfg.icon ?? null,
          weight: cfg.weight,
          sortOrder: index,
        },
      });
    } else {
      await prisma.stamp.create({
        data: {
          rallyId,
          boothId: cfg.booth_id,
          name: cfg.name,
          icon: cfg.icon ?? null,
          weight: cfg.weight,
          sortOrder: index,
        },
      });
    }
  }
}

export type StampRallyStats = {
  participant_count: number;
  completed_count: number;
  booth_rankings: Array<{
    booth_id: string;
    booth_code: string;
    company_name: string;
    stamp_name: string;
    icon: string | null;
    collect_count: number;
    weight: number;
  }>;
};

export async function getStampRallyStats(
  eventId: string,
  rallyId: string,
): Promise<StampRallyStats> {
  const rally = await prisma.stampRally.findFirst({
    where: { id: rallyId, eventId },
  });
  if (!rally) {
    throw new ApiError("集章路线不存在", ErrorCode.NOT_FOUND, 404);
  }

  const meta = await loadStampRallyMeta(eventId, rallyId);

  const [participantGroups, completedCount, boothCounts, booths] =
    await Promise.all([
      prisma.stampRecord.findMany({
        where: { rallyId },
        select: { userId: true },
        distinct: ["userId"],
      }),
      prisma.stampRallyWinner.count({ where: { rallyId } }),
      prisma.stampRecord.groupBy({
        by: ["boothId"],
        where: { rallyId },
        _count: { boothId: true },
      }),
      prisma.exhibitorBooth.findMany({
        where: { eventId, id: { in: rally.boothIds } },
        select: {
          id: true,
          code: true,
          companyOrg: { select: { name: true } },
        },
      }),
    ]);

  const boothMap = new Map(booths.map((b) => [b.id, b]));
  const countMap = new Map(
    boothCounts.map((row) => [row.boothId, row._count.boothId]),
  );

  const booth_rankings = rally.boothIds
    .map((boothId) => {
      const booth = boothMap.get(boothId);
      const cfg = meta.booth_stamps.find((s) => s.booth_id === boothId);
      return {
        booth_id: boothId,
        booth_code: booth?.code ?? boothId.slice(-4),
        company_name: booth?.companyOrg.name ?? "—",
        stamp_name: cfg?.name ?? booth?.code ?? "展位章",
        icon: cfg?.icon ?? null,
        collect_count: countMap.get(boothId) ?? 0,
        weight: cfg?.weight ?? 1,
      };
    })
    .sort((a, b) => b.collect_count - a.collect_count);

  return {
    participant_count: participantGroups.length,
    completed_count: completedCount,
    booth_rankings,
  };
}

export async function sendStampRallyReminders(
  eventId: string,
  rallyId: string,
) {
  const rally = await prisma.stampRally.findFirst({
    where: { id: rallyId, eventId },
  });
  if (!rally) {
    throw new ApiError("集章路线不存在", ErrorCode.NOT_FOUND, 404);
  }

  if (rally.status !== StampRallyStatus.ACTIVE) {
    throw new ApiError("仅进行中的集章可推送提醒", ErrorCode.VALIDATION_ERROR, 400);
  }

  const meta = await loadStampRallyMeta(eventId, rallyId);
  const weightMap = new Map(
    meta.booth_stamps.map((s) => [s.booth_id, s.weight]),
  );

  const records = await prisma.stampRecord.findMany({
    where: { rallyId },
    select: { userId: true, boothId: true },
  });

  const winners = await prisma.stampRallyWinner.findMany({
    where: { rallyId },
    select: { userId: true },
  });
  const winnerSet = new Set(winners.map((w) => w.userId));

  const userWeights = new Map<string, number>();
  for (const record of records) {
    if (winnerSet.has(record.userId)) continue;
    const w = weightMap.get(record.boothId) ?? 1;
    userWeights.set(record.userId, (userWeights.get(record.userId) ?? 0) + w);
  }

  const allParticipants = await prisma.stampRecord.findMany({
    where: { rallyId },
    select: { userId: true },
    distinct: ["userId"],
  });

  const targetUserIds = allParticipants
    .map((p) => p.userId)
    .filter((uid) => !winnerSet.has(uid));

  let sent = 0;
  let skipped = 0;

  for (const userId of targetUserIds) {
    const collected = userWeights.get(userId) ?? 0;
    const remaining = Math.max(rally.requiredCount - collected, 1);

    await prisma.notification.create({
      data: {
        userId,
        title: "集章提醒",
        body: `「${rally.name}」还差 ${remaining} 个章就能兑换${rally.prize ? `：${rally.prize}` : ""}`,
      },
    });

    const identity = await prisma.userIdentity.findFirst({
      where: { userId, provider: "wechat_mini" },
      select: { value: true },
    });

    if (identity?.value) {
      try {
        const { sendSubscribeMessage } = await import(
          "@/lib/wechat/subscribe-message"
        );
        const result = await sendSubscribeMessage({
          touser: identity.value,
          scene: "LOTTERY_RESULT",
          page: `pages/stamp/passport?eventId=${eventId}`,
          data: {
            thing1: { value: rally.name.slice(0, 20) },
            thing2: { value: `还差${remaining}个章`.slice(0, 20) },
          },
        });
        if (result.success) sent += 1;
        else skipped += 1;
      } catch {
        skipped += 1;
      }
    } else {
      skipped += 1;
    }
  }

  return {
    targeted: targetUserIds.length,
    notified: targetUserIds.length,
    wechat_sent: sent,
    wechat_skipped: skipped,
  };
}

export async function ensureOrganizerRallyDefaults(
  eventId: string,
  createdById: string,
) {
  await prisma.stampRally.updateMany({
    where: { eventId, ownerType: { not: StampOwnerType.ORGANIZER } },
    data: { ownerType: StampOwnerType.ORGANIZER },
  });

  void eventId;
  void createdById;
}
