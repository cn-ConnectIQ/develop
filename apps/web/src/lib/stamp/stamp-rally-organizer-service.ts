import {
  StampOwnerType,
  StampPointType,
  StampRallyStatus,
  prisma,
} from "@connectiq/database";
import type { Prisma } from "@connectiq/database";
import { ErrorCode } from "@connectiq/types";
import { ApiError } from "@/lib/api-auth";
import type {
  StampPointConfig,
  StampRallyMeta,
} from "@/lib/stamp/stamp-rally-config";
import {
  displayStampPointLabel,
  isBoothStampPoint,
  normalizeStampPoints,
} from "@/lib/stamp/stamp-rally-config";
import { assertStampPointQuota } from "@/lib/stamp/stamp-quota";

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
  const rawPoints = Array.isArray(obj.stamp_points)
    ? obj.stamp_points
    : obj.booth_stamps;

  const booth_stamps = Array.isArray(rawPoints)
    ? normalizeStampPoints(rawPoints as Partial<StampPointConfig>[])
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
  const payload = {
    prize_quantity: meta.prize_quantity ?? null,
    booth_stamps: meta.booth_stamps,
    stamp_points: meta.booth_stamps,
  };

  await prisma.eventSetting.upsert({
    where: {
      eventId_key: { eventId, key: stampRallyMetaKey(rallyId) },
    },
    create: {
      eventId,
      key: stampRallyMetaKey(rallyId),
      value: payload as Prisma.InputJsonValue,
    },
    update: {
      value: payload as Prisma.InputJsonValue,
    },
  });
}

function findExistingStampRow(
  existing: Array<{
    id: string;
    boothId: string | null;
    pointType: StampPointType;
    customName: string | null;
  }>,
  cfg: StampPointConfig,
) {
  if (cfg.stamp_id) {
    const byId = existing.find((s) => s.id === cfg.stamp_id);
    if (byId) return byId;
  }

  if (isBoothStampPoint(cfg) && cfg.booth_id) {
    return existing.find((s) => s.boothId === cfg.booth_id);
  }

  const customName = cfg.custom_name ?? cfg.name;
  return existing.find(
    (s) =>
      !s.boothId &&
      s.pointType === cfg.point_type &&
      s.customName === customName,
  );
}

export async function syncRallyStampRecords(
  rallyId: string,
  stampPoints: StampPointConfig[],
) {
  const normalized = normalizeStampPoints(stampPoints);
  const existing = await prisma.stamp.findMany({
    where: { rallyId },
    select: {
      id: true,
      boothId: true,
      pointType: true,
      customName: true,
    },
  });

  const newPointCount = normalized.filter(
    (cfg) => !findExistingStampRow(existing, cfg),
  ).length;
  const rally = await prisma.stampRally.findUnique({
    where: { id: rallyId },
    select: { eventId: true },
  });
  if (rally) {
    await assertStampPointQuota(rally.eventId, newPointCount);
  }

  const matchedExistingIds = new Set<string>();

  for (const [index, cfg] of normalized.entries()) {
    const displayName = displayStampPointLabel(cfg);
    const found = findExistingStampRow(existing, cfg);

    if (found) {
      matchedExistingIds.add(found.id);
      await prisma.stamp.update({
        where: { id: found.id },
        data: {
          name: displayName,
          pointType: cfg.point_type as StampPointType,
          boothId: isBoothStampPoint(cfg) ? cfg.booth_id : null,
          customName: !isBoothStampPoint(cfg)
            ? cfg.custom_name ?? cfg.name
            : null,
          location: cfg.location ?? null,
          icon: cfg.icon ?? null,
          weight: cfg.weight,
          sortOrder: index,
        },
      });
    } else {
      const created = await prisma.stamp.create({
        data: {
          rallyId,
          name: displayName,
          pointType: cfg.point_type as StampPointType,
          boothId: isBoothStampPoint(cfg) ? cfg.booth_id : null,
          customName: !isBoothStampPoint(cfg)
            ? cfg.custom_name ?? cfg.name
            : null,
          location: cfg.location ?? null,
          icon: cfg.icon ?? null,
          weight: cfg.weight,
          sortOrder: index,
        },
      });
      matchedExistingIds.add(created.id);
    }
  }

  const removeIds = existing
    .filter((s) => !matchedExistingIds.has(s.id))
    .map((s) => s.id);

  if (removeIds.length > 0) {
    await prisma.stamp.deleteMany({ where: { id: { in: removeIds } } });
  }
}

export type StampRallyStats = {
  participant_count: number;
  completed_count: number;
  booth_rankings: Array<{
    stamp_id: string | null;
    point_type: StampPointType;
    booth_id: string | null;
    booth_code: string;
    company_name: string;
    stamp_name: string;
    location: string | null;
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

  const [participantGroups, completedCount, stampRows, userStampCounts, booths] =
    await Promise.all([
      prisma.stampRecord.findMany({
        where: { rallyId },
        select: { userId: true },
        distinct: ["userId"],
      }),
      prisma.stampRallyWinner.count({ where: { rallyId } }),
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
      prisma.userStamp.groupBy({
        by: ["stampId"],
        where: { stamp: { rallyId } },
        _count: { stampId: true },
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

  const boothRecordCounts = await prisma.stampRecord.groupBy({
    by: ["boothId"],
    where: { rallyId },
    _count: { boothId: true },
  });

  const boothMap = new Map(booths.map((b) => [b.id, b]));
  const userStampCountMap = new Map(
    userStampCounts.map((row) => [row.stampId, row._count.stampId]),
  );
  const boothRecordMap = new Map(
    boothRecordCounts.map((row) => [row.boothId, row._count.boothId]),
  );

  const booth_rankings = (stampRows.length > 0
    ? stampRows.map((row) => {
        const cfg = meta.booth_stamps.find((s) =>
          isBoothStampPoint(s) && s.booth_id
            ? s.booth_id === row.boothId
            : s.custom_name === row.customName &&
              s.point_type === row.pointType,
        );
        const booth = row.booth ?? (row.boothId ? boothMap.get(row.boothId) : null);
        const boothCollect = row.boothId
          ? boothRecordMap.get(row.boothId) ?? 0
          : 0;
        const stampCollect = userStampCountMap.get(row.id) ?? 0;

        return {
          stamp_id: row.id,
          point_type: row.pointType,
          booth_id: row.boothId,
          booth_code: booth?.code ?? (row.location ? "—" : row.customName ?? "—"),
          company_name:
            booth?.companyOrg.name ??
            row.customName ??
            cfg?.name ??
            row.name,
          stamp_name: row.name || cfg?.name || "章印",
          location: row.location ?? cfg?.location ?? null,
          icon: row.icon ?? cfg?.icon ?? null,
          collect_count: Math.max(boothCollect, stampCollect),
          weight: cfg?.weight ?? row.weight,
        };
      })
    : meta.booth_stamps.map((cfg) => {
        const booth = cfg.booth_id ? boothMap.get(cfg.booth_id) : null;
        return {
          stamp_id: null,
          point_type: cfg.point_type as StampPointType,
          booth_id: cfg.booth_id ?? null,
          booth_code: booth?.code ?? cfg.location ?? "—",
          company_name:
            booth?.companyOrg.name ?? cfg.custom_name ?? cfg.name,
          stamp_name: cfg.name,
          location: cfg.location ?? null,
          icon: cfg.icon ?? null,
          collect_count: cfg.booth_id
            ? boothRecordMap.get(cfg.booth_id) ?? 0
            : 0,
          weight: cfg.weight,
        };
      })
  ).sort((a, b) => b.collect_count - a.collect_count);

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
  const stampRows = await prisma.stamp.findMany({
    where: { rallyId },
    select: { id: true, boothId: true, weight: true },
  });

  const weightByBooth = new Map(
    meta.booth_stamps
      .filter((s) => isBoothStampPoint(s) && s.booth_id)
      .map((s) => [s.booth_id!, s.weight]),
  );
  const weightByStampId = new Map(
    stampRows.map((row) => {
      const cfg = meta.booth_stamps.find((s) =>
        s.booth_id && row.boothId
          ? s.booth_id === row.boothId
          : s.stamp_id === row.id,
      );
      return [row.id, cfg?.weight ?? row.weight];
    }),
  );

  const records = await prisma.stampRecord.findMany({
    where: { rallyId },
    select: { userId: true, boothId: true },
  });

  const userStamps = await prisma.userStamp.findMany({
    where: { userId: { in: records.map((r) => r.userId) }, stamp: { rallyId } },
    select: { userId: true, stampId: true },
  });

  const winners = await prisma.stampRallyWinner.findMany({
    where: { rallyId },
    select: { userId: true },
  });
  const winnerSet = new Set(winners.map((w) => w.userId));

  const userWeights = new Map<string, number>();
  for (const record of records) {
    if (winnerSet.has(record.userId)) continue;
    const w = weightByBooth.get(record.boothId) ?? 1;
    userWeights.set(record.userId, (userWeights.get(record.userId) ?? 0) + w);
  }
  for (const row of userStamps) {
    if (winnerSet.has(row.userId)) continue;
    const w = weightByStampId.get(row.stampId) ?? 1;
    userWeights.set(row.userId, (userWeights.get(row.userId) ?? 0) + w);
  }

  const allParticipants = await prisma.stampRecord.findMany({
    where: { rallyId },
    select: { userId: true },
    distinct: ["userId"],
  });
  const customParticipants = await prisma.userStamp.findMany({
    where: { stamp: { rallyId } },
    select: { userId: true },
    distinct: ["userId"],
  });

  const targetUserIds = [...new Set([
    ...allParticipants.map((p) => p.userId),
    ...customParticipants.map((p) => p.userId),
  ])].filter((uid) => !winnerSet.has(uid));

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
