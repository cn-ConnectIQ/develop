import { LotteryStatus, prisma, type Lottery } from "@connectiq/database";
import { ErrorCode, UserRole } from "@connectiq/types";
import { ApiError, type AuthSession } from "@/lib/api-auth";
import {
  findParticipantForUser,
  hasUserCheckedIn,
  hasUserPollParticipation,
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

  if (lottery.status !== LotteryStatus.OPEN) {
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


export async function drawLotteryWinners(
  eventId: string,
  lotteryId: string,
  prizeRank: number,
  count: number,
) {
  const lottery = await getLotteryOrThrow(eventId, lotteryId);

  if (
    lottery.status !== LotteryStatus.OPEN &&
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
    if (lottery.status === LotteryStatus.OPEN) {
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
