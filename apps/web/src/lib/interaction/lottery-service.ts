import { LotteryStatus, prisma, type Lottery } from "@connectiq/database";
import { ErrorCode, UserRole } from "@connectiq/types";
import { ApiError, type AuthSession } from "@/lib/api-auth";
import {
  findParticipantForUser,
  hasUserCheckedIn,
  hasUserPollParticipation,
  ensureParticipantForUser,
} from "@/lib/interaction/participant-user";
import type { LotteryPrizeConfig } from "@/lib/interaction/schemas";
import {
  broadcastLotteryResult,
  type LotteryWinnerPayload,
} from "@/lib/realtime";
import {
  grantLotteryWinPoints,
  fisherYatesShuffle,
  sendLotteryWinNotification,
} from "@/lib/interaction/lottery-rewards";
import { isLotteryOpenForEntry } from "@/lib/lottery/booth-lottery-service";

const MANAGE_ROLES = [
  UserRole.PLATFORM_ADMIN,
  UserRole.ORGANIZER,
  UserRole.EXPO_ORGANIZER,
  UserRole.EXHIBITOR,
] as const;

const STATUS_TRANSITIONS: Record<string, LotteryStatus[]> = {
  DRAFT: ["READY", "DRAFT"] as LotteryStatus[],
  READY: ["OPEN", "DRAFT"] as LotteryStatus[],
  OPEN: ["DRAWING", "READY", "FINISHED"] as LotteryStatus[],
  DRAWING: ["FINISHED", "OPEN"] as LotteryStatus[],
  FINISHED: ["FINISHED"] as LotteryStatus[],
};

export async function requireLotteryManageAccess(
  session: AuthSession,
  eventId: string,
  lottery?: Pick<Lottery, "boothId" | "createdById"> | null,
) {
  if (!MANAGE_ROLES.includes(session.user.role as (typeof MANAGE_ROLES)[number])) {
    throw new ApiError("无权管理抽奖", ErrorCode.FORBIDDEN, 403);
  }

  if (session.user.role === UserRole.PLATFORM_ADMIN) return;

  if (session.user.role === UserRole.ORGANIZER) {
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { organizerId: true },
    });
    if (!event || event.organizerId !== session.user.id) {
      throw new ApiError("无权管理该活动抽奖", ErrorCode.FORBIDDEN, 403);
    }
    return;
  }

  if (session.user.role === UserRole.EXHIBITOR) {
    if (!lottery?.boothId) {
      throw new ApiError("展商只能管理自己展位的抽奖", ErrorCode.FORBIDDEN, 403);
    }
  const booth = await prisma.exhibitorBooth.findFirst({
      where: {
        id: lottery.boothId,
        eventId,
        OR: [
          { companyOrgId: session.user.activeOrgId ?? "" },
          { operatorUserId: session.user.id },
        ],
      },
      select: { id: true },
    });
    if (!booth) {
      throw new ApiError("无权管理该展位抽奖", ErrorCode.FORBIDDEN, 403);
    }
    return;
  }

  // EXPO_ORGANIZER：已在 requireEventAccess 校验活动权限
}

export async function assertExhibitorCanCreateLottery(
  session: AuthSession,
  eventId: string,
  boothId?: string | null,
) {
  if (session.user.role !== UserRole.EXHIBITOR) return;

  if (!boothId) {
    throw new ApiError("展商创建抽奖必须指定 booth_id", ErrorCode.VALIDATION_ERROR, 400);
  }

  const booth = await prisma.exhibitorBooth.findFirst({
    where: {
      id: boothId,
      eventId,
      OR: [
        { companyOrgId: session.user.activeOrgId ?? "" },
        { operatorUserId: session.user.id },
      ],
    },
    select: { id: true },
  });
  if (!booth) {
    throw new ApiError("只能为自己展位创建抽奖", ErrorCode.FORBIDDEN, 403);
  }
}

export function assertStatusTransition(
  current: LotteryStatus,
  next: LotteryStatus,
) {
  const allowed = STATUS_TRANSITIONS[current] ?? [];
  if (!allowed.includes(next)) {
    throw new ApiError(
      `无法从 ${current} 变更为 ${next}`,
      ErrorCode.VALIDATION_ERROR,
      400,
    );
  }
}

export function resolvePrizeName(
  prizes: unknown,
  prizeRank: number,
): string {
  const list = Array.isArray(prizes) ? (prizes as LotteryPrizeConfig[]) : [];
  const match = list.find((p) => p.rank === prizeRank);
  return match?.prize ?? match?.name ?? `第 ${prizeRank} 等奖`;
}

export async function listLotteries(eventId: string) {
  const lotteries = await prisma.lottery.findMany({
    where: { eventId },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    include: {
      booth: { select: { id: true, name: true, code: true } },
      creator: { select: { id: true, name: true } },
      _count: { select: { entries: true, winners: true } },
    },
  });

  return lotteries.map((l) => ({
    ...l,
    entryCount: l._count.entries,
    winnerCountActual: l._count.winners,
  }));
}

export async function getLotteryOrThrow(eventId: string, lotteryId: string) {
  const lottery = await prisma.lottery.findFirst({
    where: { id: lotteryId, eventId },
    include: {
      booth: { select: { id: true, name: true, companyOrgId: true } },
    },
  });
  if (!lottery) {
    throw new ApiError("抽奖不存在", ErrorCode.NOT_FOUND, 404);
  }
  return lottery;
}

export async function enterLottery(
  eventId: string,
  lotteryId: string,
  userId: string,
) {
  const lottery = await getLotteryOrThrow(eventId, lotteryId);

  if (!isLotteryOpenForEntry(lottery.status)) {
    throw new ApiError("抽奖未开放参与", ErrorCode.VALIDATION_ERROR, 400);
  }

  if (lottery.requireCheckin) {
    const checkedIn = await hasUserCheckedIn(eventId, userId);
    if (!checkedIn) {
      throw new ApiError("需要先完成签到才能参与", ErrorCode.FORBIDDEN, 403);
    }
  }

  if (lottery.requirePollId) {
    const participated = await hasUserPollParticipation(
      eventId,
      userId,
      lottery.requirePollId,
    );
    if (!participated) {
      throw new ApiError("需要先参与指定互动才能抽奖", ErrorCode.FORBIDDEN, 403);
    }
  }

  if (lottery.eligibleRoles.length > 0) {
    const participant = await findParticipantForUser(eventId, userId);
    if (
      !participant ||
      !lottery.eligibleRoles.includes(participant.role)
    ) {
      throw new ApiError("不符合参与条件", ErrorCode.FORBIDDEN, 403);
    }
  }

  try {
    const entry = await prisma.$transaction(async (tx) => {
      const created = await tx.lotteryEntry.create({
        data: {
          lotteryId,
          userId,
          source: "MANUAL",
        },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      });
      await tx.lottery.update({
        where: { id: lotteryId },
        data: { entryCount: { increment: 1 } },
      });
      return created;
    });
    return entry;
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code: string }).code === "P2002"
    ) {
      throw new ApiError("您已参与过该抽奖", ErrorCode.VALIDATION_ERROR, 400);
    }
    throw error;
  }
}

/** 小程序报名响应：异步开奖不返回即时中奖 */
export async function buildEnterLotteryMobileResponse(
  eventId: string,
  lotteryId: string,
  userId: string,
) {
  const lottery = await getLotteryOrThrow(eventId, lotteryId);

  let hasEntered = false;
  try {
    await enterLottery(eventId, lotteryId, userId);
    hasEntered = true;
  } catch (err) {
    if (err instanceof ApiError && err.message === "您已参与过该抽奖") {
      hasEntered = true;
    } else {
      throw err;
    }
  }

  const winner = await prisma.lotteryWinner.findFirst({
    where: { lotteryId, userId },
    orderBy: { drawnAt: "desc" },
  });

  const prizes = Array.isArray(lottery.prizes)
    ? (lottery.prizes as LotteryPrizeConfig[])
    : [];
  const topPrize = prizes.sort((a, b) => a.rank - b.rank)[0];

  const pendingDraw =
    !winner &&
    (isLotteryOpenForEntry(lottery.status) ||
      lottery.status === LotteryStatus.DRAWING);

  return {
    has_entered: hasEntered,
    pending_draw: pendingDraw,
    won: Boolean(winner),
    prize_name: winner?.prizeName ?? topPrize?.prize ?? topPrize?.name ?? null,
    participant_count: lottery.entryCount,
    status: lottery.status,
  };
}

export async function getLotteryMobileDetail(
  eventId: string,
  lotteryId: string,
  userId?: string | null,
) {
  const lottery = await getLotteryOrThrow(eventId, lotteryId);
  const prizes = Array.isArray(lottery.prizes)
    ? (lottery.prizes as LotteryPrizeConfig[])
    : [];
  const topPrize = prizes.sort((a, b) => a.rank - b.rank)[0];

  let hasEntered = false;
  let won = false;
  let prizeName: string | null = topPrize?.prize ?? topPrize?.name ?? null;

  if (userId) {
    const entry = await prisma.lotteryEntry.findUnique({
      where: { lotteryId_userId: { lotteryId, userId } },
    });
    hasEntered = Boolean(entry);

    const winner = await prisma.lotteryWinner.findFirst({
      where: { lotteryId, userId },
      orderBy: { drawnAt: "desc" },
    });
    if (winner) {
      won = true;
      prizeName = winner.prizeName;
    }
  }

  return {
    id: lottery.id,
    title: lottery.title,
    status: lottery.status,
    booth_id: lottery.boothId ?? null,
    has_entered: hasEntered,
    won,
    prize_name: prizeName,
    participant_count: lottery.entryCount,
    description: lottery.description,
    drawn_at: lottery.drawnAt?.toISOString() ?? null,
  };
}

export async function listLotteryWinnersMobile(
  eventId: string,
  lotteryId: string,
) {
  const lottery = await getLotteryOrThrow(eventId, lotteryId);
  const winners = await listLotteryWinners(eventId, lotteryId);

  const drawn =
    lottery.status === LotteryStatus.FINISHED ||
    lottery.drawnAt != null ||
    winners.length > 0;

  return {
    drawn,
    winners: winners.map((w) => ({
      user_id: w.userId,
      prize_tier: w.prizeRank,
      prize_name: w.prizeName,
    })),
  };
}

export type BoothLotteryLeadInput = {
  name?: string;
  phone?: string;
  company?: string;
  title?: string;
};

async function captureBoothLotteryLead(
  eventId: string,
  boothId: string,
  userId: string,
  lead?: BoothLotteryLeadInput,
) {
  if (!lead || (!lead.name && !lead.phone && !lead.company && !lead.title)) {
    return;
  }

  const participant = await ensureParticipantForUser(eventId, userId);
  if (!participant) return;

  const notes = JSON.stringify({ source: "booth_lottery", ...lead });
  const existing = await prisma.lead.findFirst({
    where: { boothId, participantId: participant.id },
  });
  if (!existing) {
    await prisma.lead.create({
      data: { boothId, participantId: participant.id, notes },
    });
    return;
  }
  if (existing.notes !== notes) {
    await prisma.lead.update({
      where: { id: existing.id },
      data: { notes },
    });
  }
}

/** 展位即时抽奖（小程序 POST /api/booths/:boothId/lottery） */
export async function drawBoothInstantLottery(
  boothId: string,
  userId: string,
  lead?: BoothLotteryLeadInput,
) {
  const booth = await prisma.exhibitorBooth.findUnique({
    where: { id: boothId },
    select: { id: true, name: true, code: true, eventId: true },
  });
  if (!booth) {
    throw new ApiError("展位不存在", ErrorCode.NOT_FOUND, 404);
  }

  const lottery = await prisma.lottery.findFirst({
    where: {
      boothId,
      eventId: booth.eventId,
      status: { in: [LotteryStatus.OPEN, LotteryStatus.ACTIVE] },
    },
    orderBy: { createdAt: "desc" },
  });
  if (!lottery) {
    throw new ApiError("该展位暂无进行中的抽奖", ErrorCode.NOT_FOUND, 404);
  }

  await captureBoothLotteryLead(booth.eventId, boothId, userId, lead);

  const existingWinner = await prisma.lotteryWinner.findFirst({
    where: { lotteryId: lottery.id, userId },
  });
  if (existingWinner) {
    return {
      lottery_id: lottery.id,
      won: true,
      prize_tier: existingWinner.prizeRank,
      prize_name: existingWinner.prizeName,
      pickup_note: `请至 ${booth.name}（${booth.code}）服务台领取奖品`,
    };
  }

  try {
    await enterLottery(booth.eventId, lottery.id, userId);
  } catch (err) {
    if (!(err instanceof ApiError && err.message === "您已参与过该抽奖")) {
      throw err;
    }
  }

  const prizes = Array.isArray(lottery.prizes)
    ? (lottery.prizes as LotteryPrizeConfig[])
    : [];
  if (prizes.length === 0) {
    return {
      lottery_id: lottery.id,
      won: false,
      prize_tier: null,
      prize_name: null,
      pickup_note: "感谢参与，欢迎继续关注展位活动",
    };
  }

  const winnerCounts = await prisma.lotteryWinner.groupBy({
    by: ["prizeRank"],
    where: { lotteryId: lottery.id },
    _count: { id: true },
  });
  const countMap = new Map(winnerCounts.map((r) => [r.prizeRank, r._count.id]));

  const available = prizes.filter(
    (p) => (countMap.get(p.rank) ?? 0) < (p.count ?? 1),
  );
  if (available.length === 0) {
    return {
      lottery_id: lottery.id,
      won: false,
      prize_tier: null,
      prize_name: null,
      pickup_note: "奖品已发完，感谢参与",
    };
  }

  const winChance = Math.min(0.35, 0.1 + available.length * 0.05);
  if (Math.random() > winChance) {
    return {
      lottery_id: lottery.id,
      won: false,
      prize_tier: null,
      prize_name: null,
      pickup_note: "感谢参与，欢迎继续关注展位活动",
    };
  }

  const totalWeight = available.reduce(
    (sum, p) => sum + ((p.count ?? 1) - (countMap.get(p.rank) ?? 0)),
    0,
  );
  let roll = Math.random() * totalWeight;
  let picked = available[0]!;
  for (const prize of available) {
    roll -= (prize.count ?? 1) - (countMap.get(prize.rank) ?? 0);
    if (roll <= 0) {
      picked = prize;
      break;
    }
  }

  const prizeName = picked.prize ?? picked.name;
  await prisma.lotteryWinner.create({
    data: {
      lotteryId: lottery.id,
      userId,
      prizeRank: picked.rank,
      prizeName,
    },
  });

  return {
    lottery_id: lottery.id,
    won: true,
    prize_tier: picked.rank,
    prize_name: prizeName,
    pickup_note: `请至 ${booth.name}（${booth.code}）服务台领取奖品`,
  };
}

export async function drawLotteryWinners(
  eventId: string,
  lotteryId: string,
  prizeRank: number,
  count: number,
) {
  const lottery = await getLotteryOrThrow(eventId, lotteryId);

  if (
    !isLotteryOpenForEntry(lottery.status) &&
    lottery.status !== LotteryStatus.DRAWING
  ) {
    throw new ApiError("当前状态无法抽奖", ErrorCode.VALIDATION_ERROR, 400);
  }

  const prizeName = resolvePrizeName(lottery.prizes, prizeRank);

  const [entries, existingWinners] = await Promise.all([
    prisma.lotteryEntry.findMany({
      where: { lotteryId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            profile: { select: { company: true } },
          },
        },
      },
    }),
    prisma.lotteryWinner.findMany({
      where: { lotteryId },
      select: { userId: true },
    }),
  ]);

  const winnerUserIds = new Set(existingWinners.map((w) => w.userId));
  let eligible = entries;

  if (!lottery.allowReenter) {
    eligible = eligible.filter((e) => !winnerUserIds.has(e.userId));
  }

  if (eligible.length === 0) {
    throw new ApiError("奖池中没有可抽取的参与者", ErrorCode.VALIDATION_ERROR, 400);
  }

  const shuffled = fisherYatesShuffle(eligible);
  const selected = shuffled.slice(0, Math.min(count, shuffled.length));

  const winners = await prisma.$transaction(async (tx) => {
    if (isLotteryOpenForEntry(lottery.status)) {
      await tx.lottery.update({
        where: { id: lotteryId },
        data: { status: LotteryStatus.DRAWING },
      });
    }

    const rows = await Promise.all(
      selected.map((entry) =>
        tx.lotteryWinner.create({
          data: {
            lotteryId,
            userId: entry.userId,
            prizeRank,
            prizeName,
          },
        }),
      ),
    );

    await tx.lottery.update({
      where: { id: lotteryId },
      data: { drawnAt: new Date() },
    });

    return rows;
  });

  const userMap = new Map(
    selected.map((e) => [e.userId, e.user]),
  );

  const payload: LotteryWinnerPayload[] = winners.map((w) => {
    const user = userMap.get(w.userId);
    return {
      id: w.id,
      userId: w.userId,
      prizeRank: w.prizeRank,
      prizeName: w.prizeName,
      name: user?.name ?? "未知用户",
      company: user?.profile?.company ?? null,
      avatarUrl: null,
      drawnAt: w.drawnAt.toISOString(),
    };
  });

  await broadcastLotteryResult(eventId, lotteryId, payload);
  await sendLotteryWinNotification(winners, lottery);
  await grantLotteryWinPoints(
    winners.map((w) => w.userId),
    lottery.title,
  );

  return payload;
}

export async function listLotteryWinners(eventId: string, lotteryId: string) {
  await getLotteryOrThrow(eventId, lotteryId);

  const winners = await prisma.lotteryWinner.findMany({
    where: { lotteryId },
    orderBy: [{ prizeRank: "asc" }, { drawnAt: "asc" }],
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          profile: { select: { company: true } },
        },
      },
    },
  });

  return winners.map((w) => ({
    id: w.id,
    userId: w.userId,
    prizeRank: w.prizeRank,
    prizeName: w.prizeName,
    drawnAt: w.drawnAt,
    notified: w.notified,
    name: w.user.name,
    email: w.user.email,
    company: w.user.profile?.company ?? null,
    avatarUrl: null,
  }));
}

/** 预估符合参与条件的参会者数量 */
export async function countLotteryEligible(
  eventId: string,
  lotteryId: string,
) {
  const lottery = await getLotteryOrThrow(eventId, lotteryId);

  const totalParticipants = await prisma.participant.count({
    where: { eventId },
  });

  if (lottery.status === "OPEN" || lottery.status === "DRAWING") {
    const entryCount = await prisma.lotteryEntry.count({ where: { lotteryId } });
    return {
      eligible: entryCount,
      total: totalParticipants,
      percentage:
        totalParticipants > 0
          ? Math.round((entryCount / totalParticipants) * 1000) / 10
          : 0,
      source: "entries" as const,
    };
  }

  let eligible = totalParticipants;

  if (lottery.type === "CHECKIN_BASED" || lottery.requireCheckin) {
    const checkedIn = await prisma.checkIn.findMany({
      where: { eventId },
      select: { participantId: true },
      distinct: ["participantId"],
    });
    let participantIds = checkedIn.map((c) => c.participantId);

    if (lottery.eligibleRoles.length > 0) {
      if (lottery.eligibleRoles.includes("VIP")) {
        eligible = await prisma.participant.count({
          where: {
            eventId,
            tickets: {
              some: {
                ticketType: {
                  name: { contains: "VIP", mode: "insensitive" },
                },
              },
            },
          },
        });
      } else {
        const filtered = await prisma.participant.findMany({
          where: {
            eventId,
            id: { in: participantIds },
            role: {
              in: lottery.eligibleRoles.filter(
                (r) => r === "ATTENDEE" || r === "SPEAKER",
              ) as ("ATTENDEE" | "SPEAKER")[],
            },
          },
          select: { id: true },
        });
        eligible = filtered.length;
      }
    } else {
      eligible = participantIds.length;
    }
  } else if (lottery.type === "ACTIVITY_BASED" && lottery.requirePollId) {
    const responses = await prisma.pollResponse.findMany({
      where: { pollId: lottery.requirePollId },
      select: { participantId: true },
      distinct: ["participantId"],
    });
    eligible = responses.filter((r) => r.participantId).length;
  } else if (lottery.type === "QUIZ_BASED" && lottery.quizPollId) {
    const responses = await prisma.pollResponse.findMany({
      where: { pollId: lottery.quizPollId },
      select: { participantId: true },
      distinct: ["participantId"],
    });
    eligible = responses.filter((r) => r.participantId).length;
  }

  return {
    eligible,
    total: totalParticipants,
    percentage:
      totalParticipants > 0
        ? Math.round((eligible / totalParticipants) * 1000) / 10
        : 0,
    source: "estimate" as const,
  };
}
