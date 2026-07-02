import type { Prisma } from "@connectiq/database";
import {
  ConnectionStatus,
  LotteryDrawType,
  LotteryOwnerType,
  LotteryStatus,
  LotteryType,
  PrizeType,
  StampOwnerType,
  StampRallyStatus,
  prisma,
} from "@connectiq/database";
import { ErrorCode } from "@connectiq/types";
import { ApiError, type AuthSession } from "@/lib/api-auth";
import type {
  CreateOrganizerLotteryInput,
  OrganizerLotteryDto,
  OrganizerLotteryEligibility,
  OrganizerLotteryMeta,
} from "@/lib/lottery/organizer-lottery-config";
import {
  defaultOrganizerEligibility,
  defaultOrganizerMeta,
  normalizeOrganizerEligibility,
} from "@/lib/lottery/organizer-lottery-config";

const metaKey = (lotteryId: string) => `organizer_lottery_meta_${lotteryId}`;

export async function loadOrganizerLotteryMeta(
  eventId: string,
  lotteryId: string,
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
  });

  const animation = obj.screen_animation;
  const validAnimations = [
    "SLOT_MACHINE",
    "WHEEL",
    "RED_ENVELOPE",
    "REVEAL_ONE_BY_ONE",
  ] as const;

  return {
    eligibility,
    screen_animation: validAnimations.includes(
      animation as (typeof validAnimations)[number],
    )
      ? (animation as OrganizerLotteryMeta["screen_animation"])
      : "SLOT_MACHINE",
    prize_draw_order: "ASC",
    target_entry_count:
      typeof obj.target_entry_count === "number"
        ? obj.target_entry_count
        : null,
  };
}

async function saveOrganizerLotteryMeta(
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
    prizeItems: Array<{
      id: string;
      name: string;
      imageUrl: string | null;
      quantity: number;
      prizeType: PrizeType;
      sortOrder: number;
    }>;
    _count: { winners: number };
  },
): Promise<OrganizerLotteryDto> {
  const meta = await loadOrganizerLotteryMeta(lottery.eventId, lottery.id);

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
      prize_type: p.prizeType,
      sort_order: p.sortOrder,
    })),
    meta,
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
    },
    orderBy: { createdAt: "desc" },
    include: lotteryInclude,
  });

  return Promise.all(lotteries.map(mapLotteryDto));
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
    screen_animation: input.screen_animation ?? "SLOT_MACHINE",
    prize_draw_order: "ASC",
    target_entry_count: input.target_entry_count ?? null,
  };

  const prizeTotal = input.prizes.reduce((sum, p) => sum + p.quantity, 0);
  const status = input.publish ? LotteryStatus.OPEN : LotteryStatus.DRAFT;
  const legacyPrizes = input.prizes.map((prize, index) => ({
    rank: index + 1,
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
          type: LotteryType.ACTIVITY_BASED,
          prizes: legacyPrizes,
          winnerCount: Math.max(prizeTotal, 1),
          drawType: LotteryDrawType.MANUAL,
          drawAt: input.draw_at ? new Date(input.draw_at) : null,
          status,
          requireLeadCapture: false,
        },
      });

      await tx.lotteryPrize.deleteMany({ where: { lotteryId } });
      for (const [index, prize] of input.prizes.entries()) {
        await tx.lotteryPrize.create({
          data: {
            lotteryId: lotteryId!,
            name: prize.name.trim(),
            imageUrl: prize.image_url ?? null,
            quantity: prize.quantity,
            remaining: prize.quantity,
            prizeType: mapPrizeType(prize.prize_type),
            sortOrder: index,
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
        type: LotteryType.ACTIVITY_BASED,
        prizes: legacyPrizes,
        requireCheckin: eligibility.require_checkin,
        winnerCount: Math.max(prizeTotal, 1),
        drawType: LotteryDrawType.MANUAL,
        drawAt: input.draw_at ? new Date(input.draw_at) : null,
        status,
        requireLeadCapture: false,
        prizeItems: {
          create: input.prizes.map((prize, index) => ({
            name: prize.name.trim(),
            imageUrl: prize.image_url ?? null,
            quantity: prize.quantity,
            remaining: prize.quantity,
            prizeType: mapPrizeType(prize.prize_type),
            sortOrder: index,
          })),
        },
      },
    });
    lotteryId = created.id;
  }

  await saveOrganizerLotteryMeta(eventId, lotteryId, meta);

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

export async function countOrganizerEligibleUsers(
  eventId: string,
  criteria: OrganizerLotteryEligibility,
  options?: {
    lotteryId?: string;
    targetEntryCount?: number | null;
  },
): Promise<EligibleCountResult> {
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

  let enteredCount: number | null = null;
  if (options?.lotteryId) {
    enteredCount = await prisma.lotteryEntry.count({
      where: { lotteryId: options.lotteryId },
    });
  }

  const eligibleCount = eligibleIds.size;
  const total = participants.length;
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
