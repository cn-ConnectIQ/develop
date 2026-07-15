import type { Prisma } from "@connectiq/database";
import {
  ConnectionStatus,
  LotteryCategory,
  LotteryDrawType,
  LotteryEntrySource,
  LotteryOwnerType,
  LotteryStatus,
  LotteryType,
  PrizeType,
  StampOwnerType,
  StampRallyStatus,
  BigScreenAnimationType,
  prisma,
} from "@connectiq/database";
import { ErrorCode } from "@connectiq/types";
import { ApiError, type AuthSession } from "@/lib/api-auth";
import { createInteractionSession } from "@/lib/interaction/session-service";
import { getInteractionScanUrl } from "@/lib/qrcode";
import type {
  CreateOrganizerLotteryInput,
  OrganizerLotteryDto,
  OrganizerLotteryEligibility,
  OrganizerLotteryMeta,
  OrganizerLotteryScanJoin,
} from "@/lib/lottery/organizer-lottery-config";
import {
  defaultOrganizerEligibility,
  defaultOrganizerMeta,
  normalizeOrganizerEligibility,
} from "@/lib/lottery/organizer-lottery-config";
import {
  normalizeBigScreenAnimationType,
} from "@/lib/lottery/big-screen-animation-config";

const metaKey = (lotteryId: string) => `organizer_lottery_meta_${lotteryId}`;

export async function loadOrganizerLotteryMeta(
  eventId: string,
  lotteryId: string,
  dbAnimation?: BigScreenAnimationType | null,
): Promise<OrganizerLotteryMeta> {
  const row = await prisma.eventSetting.findUnique({
    where: { eventId_key: { eventId, key: metaKey(lotteryId) } },
  });

  if (!row?.value || typeof row.value !== "object" || Array.isArray(row.value)) {
    return defaultOrganizerMeta();
  }

  const obj = row.value as Record<string, unknown>;
  const eligibilityRaw = obj.eligibility as Record<string, unknown> | undefined;

  const eligibility = normalizeOrganizerEligibility({
    require_checkin:
      typeof eligibilityRaw?.require_checkin === "boolean"
        ? eligibilityRaw.require_checkin
        : undefined,
    min_interactions:
      typeof eligibilityRaw?.min_interactions === "number"
        ? eligibilityRaw.min_interactions
        : undefined,
    require_stamp_rally:
      typeof eligibilityRaw?.require_stamp_rally === "boolean"
        ? eligibilityRaw.require_stamp_rally
        : undefined,
    stamp_rally_id:
      typeof eligibilityRaw?.stamp_rally_id === "string"
        ? eligibilityRaw.stamp_rally_id
        : undefined,
    min_connections:
      typeof eligibilityRaw?.min_connections === "number"
        ? eligibilityRaw.min_connections
        : undefined,
    allow_scan_join:
      typeof eligibilityRaw?.allow_scan_join === "boolean"
        ? eligibilityRaw.allow_scan_join
        : undefined,
  });

  const animation = obj.screen_animation;
  const legacyAnimation =
    typeof animation === "string" ? animation : undefined;

  const drawOrderRaw = obj.prize_draw_order;
  const prize_draw_order: OrganizerLotteryMeta["prize_draw_order"] =
    drawOrderRaw === "ALL_AT_ONCE" ? "ALL_AT_ONCE" : "ASC";

  const big_screen_animation_type = dbAnimation
    ? normalizeBigScreenAnimationType(dbAnimation)
    : normalizeBigScreenAnimationType(legacyAnimation);

  return {
    eligibility,
    big_screen_animation_type,
    prize_draw_order,
    target_entry_count:
      typeof obj.target_entry_count === "number"
        ? obj.target_entry_count
        : null,
    active_draw_tier:
      typeof obj.active_draw_tier === "number" ? obj.active_draw_tier : null,
  };
}

export async function saveOrganizerLotteryMeta(
  eventId: string,
  lotteryId: string,
  meta: OrganizerLotteryMeta,
) {
  await prisma.eventSetting.upsert({
    where: { eventId_key: { eventId, key: metaKey(lotteryId) } },
    create: {
      eventId,
      key: metaKey(lotteryId),
      value: meta as Prisma.InputJsonValue,
    },
    update: { value: meta as Prisma.InputJsonValue },
  });
}

export async function patchOrganizerLotteryDrawMeta(
  eventId: string,
  lotteryId: string,
  patch: Partial<Pick<OrganizerLotteryMeta, "active_draw_tier">>,
) {
  const meta = await loadOrganizerLotteryMeta(eventId, lotteryId);
  await saveOrganizerLotteryMeta(eventId, lotteryId, { ...meta, ...patch });
}

async function buildParticipantUserMap(eventId: string) {
  const participants = await prisma.participant.findMany({
    where: { eventId },
    select: { id: true, email: true, phone: true },
  });

  const emails = [
    ...new Set(participants.map((p) => p.email).filter(Boolean) as string[]),
  ];
  const phones = [
    ...new Set(participants.map((p) => p.phone).filter(Boolean) as string[]),
  ];

  const orFilters: Prisma.UserWhereInput[] = [];
  if (emails.length) orFilters.push({ email: { in: emails } });
  if (phones.length) orFilters.push({ phone: { in: phones } });

  const users =
    orFilters.length > 0
      ? await prisma.user.findMany({
          where: { OR: orFilters },
          select: { id: true, email: true, phone: true },
        })
      : [];

  const emailMap = new Map(users.map((u) => [u.email, u.id]));
  const phoneMap = new Map(users.map((u) => [u.phone, u.id]));
  const participantToUser = new Map<string, string>();

  for (const p of participants) {
    const userId =
      (p.email && emailMap.get(p.email)) ||
      (p.phone && phoneMap.get(p.phone)) ||
      null;
    if (userId) participantToUser.set(p.id, userId);
  }

  return { participants, participantToUser };
}

function mapPrizeType(raw: string) {
  if (raw === "DIGITAL") return PrizeType.DIGITAL;
  if (raw === "EXPERIENCE") return PrizeType.EXPERIENCE;
  return PrizeType.PHYSICAL;
}

async function mapLotteryDto(
  lottery: {
    id: string;
    eventId: string;
    title: string;
    description: string | null;
    coverImage: string | null;
    status: LotteryStatus;
    drawAt: Date | null;
    entryCount: number;
    createdAt: Date;
    bigScreenAnimationType: BigScreenAnimationType | null;
    prizeItems: Array<{
      id: string;
      name: string;
      imageUrl: string | null;
      quantity: number;
      prizeType: PrizeType;
      sortOrder: number;
      tier: number | null;
    }>;
    _count: { winners: number };
  },
): Promise<OrganizerLotteryDto> {
  const meta = await loadOrganizerLotteryMeta(
    lottery.eventId,
    lottery.id,
    lottery.bigScreenAnimationType,
  );

  const scan_join =
    meta.eligibility.allow_scan_join
      ? await resolveOrganizerLotteryScanJoin(lottery.eventId, lottery.id)
      : null;

  return {
    id: lottery.id,
    title: lottery.title,
    description: lottery.description,
    cover_image: lottery.coverImage,
    status: lottery.status,
    draw_at: lottery.drawAt?.toISOString() ?? null,
    entry_count: lottery.entryCount,
    winner_count: lottery._count.winners,
    prizes: lottery.prizeItems.map((p) => ({
      id: p.id,
      name: p.name,
      image_url: p.imageUrl,
      quantity: p.quantity,
      tier: p.tier ?? p.sortOrder + 1,
      prize_type: p.prizeType,
      sort_order: p.sortOrder,
    })),
    meta,
    scan_join,
    created_at: lottery.createdAt.toISOString(),
  };
}

const lotteryInclude = {
  prizeItems: { orderBy: { sortOrder: "asc" as const } },
  _count: { select: { winners: true } },
} as const;

export async function listOrganizerGrandLotteries(
  eventId: string,
): Promise<OrganizerLotteryDto[]> {
  const lotteries = await prisma.lottery.findMany({
    where: {
      eventId,
      ownerType: LotteryOwnerType.ORGANIZER,
      boothId: null,
      lotteryCategory: LotteryCategory.POOL_DRAW,
    },
    orderBy: { createdAt: "desc" },
    include: lotteryInclude,
  });

  return Promise.all(lotteries.map(mapLotteryDto));
}

export async function getOrganizerGrandLottery(
  eventId: string,
  lotteryId: string,
): Promise<OrganizerLotteryDto | null> {
  const lottery = await prisma.lottery.findFirst({
    where: {
      id: lotteryId,
      eventId,
      ownerType: LotteryOwnerType.ORGANIZER,
      boothId: null,
      lotteryCategory: LotteryCategory.POOL_DRAW,
    },
    include: lotteryInclude,
  });

  if (!lottery) return null;
  return mapLotteryDto(lottery);
}

async function resolveActiveOrganizerStampRallyId(eventId: string) {
  const rally = await prisma.stampRally.findFirst({
    where: {
      eventId,
      ownerType: StampOwnerType.ORGANIZER,
      status: StampRallyStatus.ACTIVE,
    },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  return rally?.id ?? null;
}

function sessionMatchesLotteryScan(
  interactions: unknown,
  settings: unknown,
  lotteryId: string,
) {
  const settingsObj =
    settings && typeof settings === "object" && !Array.isArray(settings)
      ? (settings as Record<string, unknown>)
      : {};
  if (settingsObj.scan_join_lottery_id === lotteryId) return true;
  if (!Array.isArray(interactions)) return false;
  return interactions.some(
    (ref) =>
      ref &&
      typeof ref === "object" &&
      (ref as { type?: string; id?: string }).type === "lottery" &&
      (ref as { id?: string }).id === lotteryId &&
      settingsObj.allow_scan_join === true,
  );
}

export async function resolveOrganizerLotteryScanJoin(
  eventId: string,
  lotteryId: string,
): Promise<OrganizerLotteryScanJoin | null> {
  const sessions = await prisma.interactionSession.findMany({
    where: {
      eventId,
      boothId: null,
      isActive: true,
    },
    orderBy: { createdAt: "desc" },
    take: 80,
    select: {
      id: true,
      sessionCode: true,
      qrUrl: true,
      interactions: true,
      settings: true,
    },
  });

  const hit = sessions.find((s) =>
    sessionMatchesLotteryScan(s.interactions, s.settings, lotteryId),
  );
  if (!hit) return null;

  return {
    session_id: hit.id,
    session_code: hit.sessionCode,
    qr_url: hit.qrUrl,
    scan_url: getInteractionScanUrl(hit.sessionCode),
  };
}

export async function ensureOrganizerLotteryScanSession(input: {
  eventId: string;
  lotteryId: string;
  title: string;
  createdById: string;
}): Promise<OrganizerLotteryScanJoin> {
  const existing = await resolveOrganizerLotteryScanJoin(
    input.eventId,
    input.lotteryId,
  );
  if (existing) return existing;

  const session = await createInteractionSession({
    eventId: input.eventId,
    createdById: input.createdById,
    name: `${input.title} · 扫码入池`,
    interactions: [{ type: "lottery", id: input.lotteryId }],
    ownerType: "ORGANIZER",
    settings: {
      allow_scan_join: true,
      scan_join_lottery_id: input.lotteryId,
    },
    skipBilling: true,
  });

  return {
    session_id: session.id,
    session_code: session.sessionCode,
    qr_url: session.qrUrl,
    scan_url: getInteractionScanUrl(session.sessionCode),
  };
}

async function deactivateOrganizerLotteryScanSessions(
  eventId: string,
  lotteryId: string,
) {
  const sessions = await prisma.interactionSession.findMany({
    where: { eventId, boothId: null, isActive: true },
    select: { id: true, interactions: true, settings: true },
    take: 80,
  });
  const ids = sessions
    .filter((s) =>
      sessionMatchesLotteryScan(s.interactions, s.settings, lotteryId),
    )
    .map((s) => s.id);
  if (ids.length === 0) return;
  await prisma.interactionSession.updateMany({
    where: { id: { in: ids } },
    data: { isActive: false },
  });
}

export async function upsertOrganizerGrandLottery(
  eventId: string,
  session: AuthSession,
  input: CreateOrganizerLotteryInput,
): Promise<OrganizerLotteryDto> {
  const eligibility = normalizeOrganizerEligibility(input.eligibility);

  if (eligibility.require_stamp_rally && !eligibility.stamp_rally_id) {
    eligibility.stamp_rally_id = await resolveActiveOrganizerStampRallyId(eventId);
  }

  const meta: OrganizerLotteryMeta = {
    eligibility,
    big_screen_animation_type:
      input.big_screen_animation_type ??
      (input.screen_animation
        ? normalizeBigScreenAnimationType(input.screen_animation)
        : BigScreenAnimationType.ROLLING_MACHINE),
    prize_draw_order: input.prize_draw_order ?? "ASC",
    target_entry_count: input.target_entry_count ?? null,
    active_draw_tier: null,
  };

  const bigScreenAnimationType = meta.big_screen_animation_type;

  const sortedPrizes = [...input.prizes].sort(
    (a, b) => (a.tier ?? 99) - (b.tier ?? 99),
  );

  const prizeTotal = sortedPrizes.reduce((sum, p) => sum + p.quantity, 0);
  const status = input.publish ? LotteryStatus.OPEN : LotteryStatus.DRAFT;
  const legacyPrizes = sortedPrizes.map((prize) => ({
    rank: prize.tier ?? 1,
    name: prize.name,
    prize: prize.name,
    count: prize.quantity,
    image_url: prize.image_url,
  }));

  let lotteryId = input.id;

  if (lotteryId) {
    const existing = await prisma.lottery.findFirst({
      where: {
        id: lotteryId,
        eventId,
        ownerType: LotteryOwnerType.ORGANIZER,
        boothId: null,
      },
    });
    if (!existing) {
      throw new ApiError("抽奖不存在", ErrorCode.NOT_FOUND, 404);
    }

    await prisma.$transaction(async (tx) => {
      await tx.lottery.update({
        where: { id: lotteryId },
        data: {
          title: input.title.trim(),
          description: input.description?.trim() || null,
          coverImage: input.cover_image ?? null,
          requireCheckin: eligibility.require_checkin,
          lotteryCategory: LotteryCategory.POOL_DRAW,
          type: LotteryType.ACTIVITY_BASED,
          prizes: legacyPrizes,
          winnerCount: Math.max(prizeTotal, 1),
          drawType: LotteryDrawType.MANUAL,
          drawAt: input.draw_at ? new Date(input.draw_at) : null,
          status,
          requireLeadCapture: false,
          bigScreenAnimationType,
        },
      });

      await tx.lotteryPrize.deleteMany({ where: { lotteryId } });
      for (const [index, prize] of sortedPrizes.entries()) {
        const tier = prize.tier ?? index + 1;
        await tx.lotteryPrize.create({
          data: {
            lotteryId: lotteryId!,
            name: prize.name.trim(),
            imageUrl: prize.image_url ?? null,
            quantity: prize.quantity,
            remaining: prize.quantity,
            prizeType: mapPrizeType(prize.prize_type),
            sortOrder: index,
            tier,
          },
        });
      }
    });
  } else {
    const created = await prisma.lottery.create({
      data: {
        eventId,
        createdById: session.user.id,
        ownerType: LotteryOwnerType.ORGANIZER,
        boothId: null,
        title: input.title.trim(),
        description: input.description?.trim() || null,
        coverImage: input.cover_image ?? null,
        lotteryCategory: LotteryCategory.POOL_DRAW,
        type: LotteryType.ACTIVITY_BASED,
        prizes: legacyPrizes,
        requireCheckin: eligibility.require_checkin,
        winnerCount: Math.max(prizeTotal, 1),
        drawType: LotteryDrawType.MANUAL,
        drawAt: input.draw_at ? new Date(input.draw_at) : null,
        status,
        requireLeadCapture: false,
        bigScreenAnimationType,
        prizeItems: {
          create: sortedPrizes.map((prize, index) => ({
            name: prize.name.trim(),
            imageUrl: prize.image_url ?? null,
            quantity: prize.quantity,
            remaining: prize.quantity,
            prizeType: mapPrizeType(prize.prize_type),
            sortOrder: index,
            tier: prize.tier ?? index + 1,
          })),
        },
      },
    });
    lotteryId = created.id;
  }

  await saveOrganizerLotteryMeta(eventId, lotteryId, meta);

  if (eligibility.allow_scan_join && status === LotteryStatus.OPEN) {
    await ensureOrganizerLotteryScanSession({
      eventId,
      lotteryId: lotteryId!,
      title: input.title.trim(),
      createdById: session.user.id,
    });
  } else {
    await deactivateOrganizerLotteryScanSessions(eventId, lotteryId!);
  }

  if (status === LotteryStatus.OPEN) {
    await syncOrganizerLotteryEntriesFromEligibility(eventId, lotteryId!);
  }

  const lottery = await prisma.lottery.findUniqueOrThrow({
    where: { id: lotteryId },
    include: lotteryInclude,
  });

  return mapLotteryDto(lottery);
}

export type EligibleCountResult = {
  eligible_count: number;
  total_participants: number;
  entered_count: number | null;
  target_entry_count: number | null;
  percentage: number;
  vs_target: number | null;
};

type EligibleParticipantResolution = {
  participantIds: Set<string>;
  participantToUser: Map<string, string>;
  totalParticipants: number;
};

async function resolveOrganizerEligibleParticipants(
  eventId: string,
  criteria: OrganizerLotteryEligibility,
): Promise<EligibleParticipantResolution> {
  const { participants, participantToUser } =
    await buildParticipantUserMap(eventId);

  let eligibleIds = new Set(participants.map((p) => p.id));

  if (criteria.require_checkin) {
    const checkedIn = await prisma.checkIn.findMany({
      where: { eventId },
      select: { participantId: true },
      distinct: ["participantId"],
    });
    const checkedSet = new Set(checkedIn.map((c) => c.participantId));
    eligibleIds = new Set([...eligibleIds].filter((id) => checkedSet.has(id)));
  }

  if (criteria.min_interactions && criteria.min_interactions > 0) {
    const pollIds = await prisma.poll.findMany({
      where: { eventId },
      select: { id: true },
    });
    const pollIdList = pollIds.map((p) => p.id);

    if (pollIdList.length > 0) {
      const counts = await prisma.pollResponse.groupBy({
        by: ["participantId"],
        where: {
          pollId: { in: pollIdList },
          participantId: { not: null },
        },
        _count: { participantId: true },
      });

      const qualified = new Set(
        counts
          .filter(
            (row) =>
              row.participantId &&
              row._count.participantId >= criteria.min_interactions!,
          )
          .map((row) => row.participantId!),
      );
      eligibleIds = new Set([...eligibleIds].filter((id) => qualified.has(id)));
    } else {
      eligibleIds = new Set();
    }
  }

  if (criteria.require_stamp_rally) {
    let rallyId = criteria.stamp_rally_id;
    if (!rallyId) {
      const rally = await prisma.stampRally.findFirst({
        where: {
          eventId,
          ownerType: StampOwnerType.ORGANIZER,
          status: StampRallyStatus.ACTIVE,
        },
        orderBy: { createdAt: "desc" },
        select: { id: true },
      });
      rallyId = rally?.id ?? null;
    }

    if (rallyId) {
      const [winners, completedProgress] = await Promise.all([
        prisma.stampRallyWinner.findMany({
          where: { rallyId },
          select: { userId: true },
        }),
        prisma.userStampProgress.findMany({
          where: { rallyId, isCompleted: true },
          select: { userId: true },
        }),
      ]);

      const completedUsers = new Set([
        ...winners.map((w) => w.userId),
        ...completedProgress.map((p) => p.userId),
      ]);

      eligibleIds = new Set(
        [...eligibleIds].filter((pid) => {
          const userId = participantToUser.get(pid);
          return userId && completedUsers.has(userId);
        }),
      );
    } else {
      eligibleIds = new Set();
    }
  }

  if (criteria.min_connections && criteria.min_connections > 0) {
    const connections = await prisma.businessConnection.findMany({
      where: { eventId, status: ConnectionStatus.ACTIVE },
      select: { userAId: true, userBId: true },
    });

    const countMap = new Map<string, number>();
    for (const conn of connections) {
      for (const uid of [conn.userAId, conn.userBId]) {
        if (!uid) continue;
        countMap.set(uid, (countMap.get(uid) ?? 0) + 1);
      }
    }

    eligibleIds = new Set(
      [...eligibleIds].filter((pid) => {
        const userId = participantToUser.get(pid);
        if (!userId) return false;
        return (countMap.get(userId) ?? 0) >= criteria.min_connections!;
      }),
    );
  }

  return {
    participantIds: eligibleIds,
    participantToUser,
    totalParticipants: participants.length,
  };
}

/** 将符合门槛的参会者自动写入抽奖奖池（大屏开奖用） */
export async function syncOrganizerLotteryEntriesFromEligibility(
  eventId: string,
  lotteryId: string,
): Promise<{ synced: number; entry_count: number }> {
  const lottery = await prisma.lottery.findFirst({
    where: {
      id: lotteryId,
      eventId,
      ownerType: LotteryOwnerType.ORGANIZER,
      boothId: null,
    },
    select: { id: true, status: true },
  });

  if (!lottery) {
    throw new ApiError("全场抽奖不存在", ErrorCode.NOT_FOUND, 404);
  }

  if (
    lottery.status !== LotteryStatus.OPEN &&
    lottery.status !== LotteryStatus.DRAWING
  ) {
    const entry_count = await prisma.lotteryEntry.count({ where: { lotteryId } });
    return { synced: 0, entry_count };
  }

  const meta = await loadOrganizerLotteryMeta(eventId, lotteryId);
  const { participantIds, participantToUser } =
    await resolveOrganizerEligibleParticipants(eventId, meta.eligibility);

  const userIds = [
    ...new Set(
      [...participantIds]
        .map((participantId) => participantToUser.get(participantId))
        .filter((userId): userId is string => Boolean(userId)),
    ),
  ];

  if (userIds.length === 0) {
    const entry_count = await prisma.lotteryEntry.count({ where: { lotteryId } });
    return { synced: 0, entry_count };
  }

  const existing = await prisma.lotteryEntry.findMany({
    where: { lotteryId, userId: { in: userIds } },
    select: { userId: true },
  });
  const existingSet = new Set(existing.map((row) => row.userId));
  const toCreate = userIds.filter((userId) => !existingSet.has(userId));

  if (toCreate.length > 0) {
    await prisma.lotteryEntry.createMany({
      data: toCreate.map((userId) => ({
        lotteryId,
        userId,
        source: LotteryEntrySource.AUTO_CHECKIN,
      })),
      skipDuplicates: true,
    });
  }

  const entry_count = await prisma.lotteryEntry.count({ where: { lotteryId } });
  await prisma.lottery.update({
    where: { id: lotteryId },
    data: { entryCount: entry_count },
  });

  return { synced: toCreate.length, entry_count };
}

export async function countOrganizerEligibleUsers(
  eventId: string,
  criteria: OrganizerLotteryEligibility,
  options?: {
    lotteryId?: string;
    targetEntryCount?: number | null;
    syncEntries?: boolean;
  },
): Promise<EligibleCountResult> {
  const { participantIds, totalParticipants } =
    await resolveOrganizerEligibleParticipants(eventId, criteria);

  if (options?.lotteryId && options.syncEntries !== false) {
    await syncOrganizerLotteryEntriesFromEligibility(eventId, options.lotteryId);
  }

  let enteredCount: number | null = null;
  if (options?.lotteryId) {
    enteredCount = await prisma.lotteryEntry.count({
      where: { lotteryId: options.lotteryId },
    });
  }

  const eligibleCount = participantIds.size;
  const total = totalParticipants;
  const target =
    options?.targetEntryCount ??
    (options?.lotteryId
      ? (await loadOrganizerLotteryMeta(eventId, options.lotteryId))
          .target_entry_count
      : null);

  return {
    eligible_count: eligibleCount,
    total_participants: total,
    entered_count: enteredCount,
    target_entry_count: target,
    percentage:
      total > 0 ? Math.round((eligibleCount / total) * 1000) / 10 : 0,
    vs_target:
      target && target > 0
        ? Math.round((eligibleCount / target) * 1000) / 10
        : null,
  };
}
