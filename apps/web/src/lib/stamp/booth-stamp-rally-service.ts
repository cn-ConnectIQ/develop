import type { Prisma } from "@connectiq/database";
import {
  StampOwnerType,
  StampRallyStatus,
  prisma,
} from "@connectiq/database";
import { ErrorCode } from "@connectiq/types";
import { ApiError, type AuthSession } from "@/lib/api-auth";
import type {
  BoothCheckpointDto,
  BoothStampRallyDto,
  UpsertBoothStampRallyInput,
} from "@/lib/stamp/booth-stamp-rally-schemas";
import {
  generateStampQR,
  getStampScanUrl,
} from "@/lib/stamp/stamp-qrcode";

const metaKey = (rallyId: string) => `booth_stamp_rally_meta_${rallyId}`;

type BoothRallyMeta = {
  require_all: boolean;
};

async function loadMeta(
  eventId: string,
  rallyId: string,
): Promise<BoothRallyMeta> {
  const row = await prisma.eventSetting.findUnique({
    where: { eventId_key: { eventId, key: metaKey(rallyId) } },
  });
  if (!row?.value || typeof row.value !== "object" || Array.isArray(row.value)) {
    return { require_all: true };
  }
  const obj = row.value as Record<string, unknown>;
  return {
    require_all: obj.require_all !== false,
  };
}

async function saveMeta(
  eventId: string,
  rallyId: string,
  meta: BoothRallyMeta,
) {
  await prisma.eventSetting.upsert({
    where: { eventId_key: { eventId, key: metaKey(rallyId) } },
    create: {
      eventId,
      key: metaKey(rallyId),
      value: meta as Prisma.InputJsonValue,
    },
    update: { value: meta as Prisma.InputJsonValue },
  });
}

async function mapCheckpoint(
  stamp: {
    id: string;
    name: string;
    icon: string | null;
    scanCode: string;
    sortOrder: number;
  },
  collectCount: number,
): Promise<BoothCheckpointDto> {
  const qr_url = await generateStampQR(stamp.id, stamp.scanCode);
  return {
    id: stamp.id,
    name: stamp.name,
    icon: stamp.icon,
    scan_code: stamp.scanCode,
    scan_url: getStampScanUrl(stamp.id, stamp.scanCode),
    qr_url,
    collect_count: collectCount,
    sort_order: stamp.sortOrder,
  };
}

async function mapRally(
  rally: {
    id: string;
    eventId: string;
    name: string;
    description: string | null;
    prize: string;
    prizeImageUrl: string | null;
    prizeDesc: string | null;
    requiredCount: number;
    status: StampRallyStatus;
    createdAt: Date;
    updatedAt: Date;
    stamps: Array<{
      id: string;
      name: string;
      icon: string | null;
      scanCode: string;
      sortOrder: number;
    }>;
  },
  stats: {
    participant_count: number;
    completed_count: number;
    collectByStamp: Map<string, number>;
  },
  meta: BoothRallyMeta,
): Promise<BoothStampRallyDto> {
  const checkpoints = await Promise.all(
    rally.stamps
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((stamp) =>
        mapCheckpoint(stamp, stats.collectByStamp.get(stamp.id) ?? 0),
      ),
  );

  return {
    id: rally.id,
    name: rally.name,
    description: rally.description,
    prize: rally.prize,
    prize_image_url: rally.prizeImageUrl,
    prize_desc: rally.prizeDesc,
    required_count: rally.requiredCount,
    require_all: meta.require_all,
    total_checkpoints: rally.stamps.length,
    status: rally.status,
    participant_count: stats.participant_count,
    completed_count: stats.completed_count,
    checkpoints,
    created_at: rally.createdAt.toISOString(),
    updated_at: rally.updatedAt.toISOString(),
  };
}

async function loadRallyStats(rallyId: string) {
  const [participants, completed, stampCounts] = await Promise.all([
    prisma.userStamp.findMany({
      where: { stamp: { rallyId } },
      select: { userId: true },
      distinct: ["userId"],
    }),
    prisma.stampRallyWinner.count({ where: { rallyId } }),
    prisma.userStamp.groupBy({
      by: ["stampId"],
      where: { stamp: { rallyId } },
      _count: { stampId: true },
    }),
  ]);

  const collectByStamp = new Map(
    stampCounts.map((row) => [row.stampId, row._count.stampId]),
  );

  return {
    participant_count: participants.length,
    completed_count: completed,
    collectByStamp,
  };
}

const rallyInclude = {
  stamps: {
    orderBy: { sortOrder: "asc" as const },
    select: {
      id: true,
      name: true,
      icon: true,
      scanCode: true,
      sortOrder: true,
    },
  },
} as const;

export async function listBoothStampRallies(
  boothId: string,
): Promise<BoothStampRallyDto[]> {
  const booth = await prisma.exhibitorBooth.findUnique({
    where: { id: boothId },
    select: { eventId: true },
  });
  if (!booth) {
    throw new ApiError("展位不存在", ErrorCode.NOT_FOUND, 404);
  }

  const rallies = await prisma.stampRally.findMany({
    where: {
      boothId,
      ownerType: StampOwnerType.EXHIBITOR,
    },
    orderBy: { createdAt: "desc" },
    include: rallyInclude,
  });

  return Promise.all(
    rallies.map(async (rally) => {
      const [stats, meta] = await Promise.all([
        loadRallyStats(rally.id),
        loadMeta(booth.eventId, rally.id),
      ]);
      return mapRally(rally, stats, meta);
    }),
  );
}

function resolveRequiredCount(
  input: UpsertBoothStampRallyInput,
  checkpointCount: number,
) {
  const requireAll = input.require_all !== false;
  if (requireAll) return checkpointCount;
  const count = input.required_count ?? checkpointCount;
  if (count < 1 || count > checkpointCount) {
    throw new ApiError(
      `目标章数应在 1 – ${checkpointCount} 之间`,
      ErrorCode.VALIDATION_ERROR,
      400,
    );
  }
  return count;
}

async function syncCheckpoints(
  rallyId: string,
  checkpoints: UpsertBoothStampRallyInput["checkpoints"],
) {
  const existing = await prisma.stamp.findMany({
    where: { rallyId },
    select: { id: true },
  });
  const keepIds = new Set(
    checkpoints.map((c) => c.id).filter(Boolean) as string[],
  );
  const removeIds = existing
    .filter((s) => !keepIds.has(s.id))
    .map((s) => s.id);

  if (removeIds.length > 0) {
    await prisma.stamp.deleteMany({ where: { id: { in: removeIds } } });
  }

  for (const [index, checkpoint] of checkpoints.entries()) {
    if (checkpoint.id) {
      await prisma.stamp.update({
        where: { id: checkpoint.id },
        data: {
          name: checkpoint.name.trim(),
          icon: checkpoint.icon ?? null,
          sortOrder: index,
        },
      });
    } else {
      await prisma.stamp.create({
        data: {
          rallyId,
          boothId: null,
          name: checkpoint.name.trim(),
          icon: checkpoint.icon ?? "📍",
          sortOrder: index,
          weight: 1,
        },
      });
    }
  }
}

export async function upsertBoothStampRally(
  boothId: string,
  session: AuthSession,
  input: UpsertBoothStampRallyInput,
): Promise<BoothStampRallyDto> {
  const booth = await prisma.exhibitorBooth.findUnique({
    where: { id: boothId },
    select: { id: true, eventId: true },
  });
  if (!booth) {
    throw new ApiError("展位不存在", ErrorCode.NOT_FOUND, 404);
  }

  const requiredCount = resolveRequiredCount(input, input.checkpoints.length);
  const requireAll = input.require_all !== false;
  const status = input.publish
    ? StampRallyStatus.ACTIVE
    : StampRallyStatus.DRAFT;

  let rallyId = input.id;

  if (rallyId) {
    const existing = await prisma.stampRally.findFirst({
      where: {
        id: rallyId,
        boothId,
        ownerType: StampOwnerType.EXHIBITOR,
      },
    });
    if (!existing) {
      throw new ApiError("集章活动不存在", ErrorCode.NOT_FOUND, 404);
    }

    await prisma.stampRally.update({
      where: { id: rallyId },
      data: {
        name: input.name.trim(),
        description: input.description?.trim() || null,
        prize: input.prize.trim(),
        prizeImageUrl: input.prize_image_url ?? null,
        prizeDesc: input.prize_desc?.trim() || null,
        requiredCount,
        totalBooths: input.checkpoints.length,
        status,
      },
    });

    await syncCheckpoints(rallyId, input.checkpoints);
    await saveMeta(booth.eventId, rallyId, { require_all: requireAll });
  } else {
    const created = await prisma.stampRally.create({
      data: {
        eventId: booth.eventId,
        createdById: session.user.id,
        ownerType: StampOwnerType.EXHIBITOR,
        boothId: booth.id,
        name: input.name.trim(),
        description: input.description?.trim() || null,
        prize: input.prize.trim(),
        prizeImageUrl: input.prize_image_url ?? null,
        prizeDesc: input.prize_desc?.trim() || null,
        requiredCount,
        totalBooths: input.checkpoints.length,
        boothIds: [booth.id],
        status,
      },
    });
    rallyId = created.id;

    for (const [index, checkpoint] of input.checkpoints.entries()) {
      await prisma.stamp.create({
        data: {
          rallyId,
          boothId: null,
          name: checkpoint.name.trim(),
          icon: checkpoint.icon ?? "📍",
          sortOrder: index,
          weight: 1,
        },
      });
    }

    await saveMeta(booth.eventId, rallyId, { require_all: requireAll });
  }

  const rally = await prisma.stampRally.findUniqueOrThrow({
    where: { id: rallyId },
    include: rallyInclude,
  });

  const [stats, meta] = await Promise.all([
    loadRallyStats(rallyId),
    loadMeta(booth.eventId, rallyId),
  ]);

  return mapRally(rally, stats, meta);
}
