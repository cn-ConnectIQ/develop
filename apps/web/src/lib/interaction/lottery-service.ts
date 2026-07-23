import {
  InviteStatus,
  LotteryCategory,
  LotteryStatus,
  OrgStaffRole,
  prisma,
  type Lottery,
  type Prisma,
} from "@connectiq/database";
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
import { attachToEventCode } from "@/lib/lottery/redemption";
import { formatEventCodeForScan } from "@/lib/event-code";

const MANAGE_ROLES = [
  UserRole.PLATFORM_ADMIN,
  UserRole.ORGANIZER,
  UserRole.EXPO_ORGANIZER,
  UserRole.EXHIBITOR,
] as const;

const STATUS_TRANSITIONS: Record<string, LotteryStatus[]> = {
  DRAFT: ["READY", "DRAFT", "ACTIVE"] as LotteryStatus[],
  READY: ["OPEN", "DRAFT", "ACTIVE"] as LotteryStatus[],
  OPEN: ["DRAWING", "READY", "FINISHED", "DRAFT"] as LotteryStatus[],
  DRAWING: ["FINISHED", "OPEN"] as LotteryStatus[],
  FINISHED: ["FINISHED"] as LotteryStatus[],
  ACTIVE: ["DRAFT", "ACTIVE", "ENDED", "FINISHED"] as LotteryStatus[],
  ENDED: ["ACTIVE", "ENDED"] as LotteryStatus[],
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

  // ORGANIZER / EXPO_ORGANIZER：与 requireEventAccess 对齐——账号管理员按活动 org 归属校验
  if (
    session.user.role === UserRole.ORGANIZER ||
    session.user.role === UserRole.EXPO_ORGANIZER
  ) {
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { organizerId: true, orgId: true },
    });
    if (!event) {
      throw new ApiError("无权管理该活动抽奖", ErrorCode.FORBIDDEN, 403);
    }

    const activeOrgId = session.user.activeOrgId ?? null;
    const belongsToActiveOrg =
      Boolean(activeOrgId) && event.orgId === activeOrgId;
    const isLegacyOrganizer = event.organizerId === session.user.id;

    if (!belongsToActiveOrg && !isLegacyOrganizer) {
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
        {
          companyOrg: {
            staff: {
              some: {
                userId: session.user.id,
                status: InviteStatus.ACCEPTED,
                role: { in: [OrgStaffRole.OWNER, OrgStaffRole.ADMIN] },
              },
            },
          },
        },
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

export type ParticipantLotteryPrizeItem = {
  id?: string;
  name: string;
  quantity: number;
  remaining: number;
  /** 0–100 百分比；直接领取类型为 null */
  probability_percent: number | null;
};

export type ParticipantLotteryListItem = {
  id: string;
  title: string;
  status: string;
  lottery_category: LotteryCategory;
  animation_type: string | null;
  trigger_action: string | null;
  owner_type: string;
  booth: { id: string; name: string; code: string } | null;
  entry_count: number;
  winner_count: number;
  prize_count: number;
  today_entry_count: number;
  remaining_stock: number;
  is_stock_depleted: boolean;
  prizes: ParticipantLotteryPrizeItem[];
  created_at: string;
};

function resolveLegacyPrizeCount(prizes: unknown): number {
  if (!Array.isArray(prizes)) return 0;
  return prizes.reduce((sum, raw) => {
    if (!raw || typeof raw !== "object") return sum;
    const count = (raw as { count?: number }).count;
    return sum + (typeof count === "number" ? count : 1);
  }, 0);
}

export type MobileParticipantLotteryItem = ParticipantLotteryListItem & {
  today_entry_count: number;
  remaining_stock: number;
  is_stock_depleted: boolean;
  is_mine: boolean;
  session_id: string | null;
  qr_url: string | null;
  created_by_id: string;
};

export type ListMobileParticipantLotteriesOptions = {
  scope: "ALL" | "MY_BOOTH";
  boothId?: string;
  categories?: LotteryCategory[];
  userId?: string;
};

function parseInteractionRefs(raw: unknown): Array<{ type?: string; id?: string }> {
  return Array.isArray(raw) ? (raw as Array<{ type?: string; id?: string }>) : [];
}

function resolveRemainingStock(
  prizeItems: Array<{ quantity: number; remaining: number }>,
  legacyPrizes: unknown,
): number {
  if (prizeItems.length > 0) {
    return prizeItems.reduce((sum, prize) => sum + prize.remaining, 0);
  }
  return resolveLegacyPrizeCount(legacyPrizes);
}

/** 小程序 · 参与人抽奖列表（LOTTERY-LIST-02 / scope=ALL|MY_BOOTH） */
export async function listMobileParticipantLotteries(
  eventId: string,
  options: ListMobileParticipantLotteriesOptions,
): Promise<MobileParticipantLotteryItem[]> {
  const categories = options.categories?.length
    ? options.categories
    : [LotteryCategory.AUTO_PROBABILITY, LotteryCategory.INSTANT_CLAIM];

  const where: Prisma.LotteryWhereInput = {
    eventId,
    lotteryCategory: { in: categories },
  };

  if (options.scope === "MY_BOOTH") {
    where.boothId = options.boothId ?? "__none__";
  } else if (options.boothId) {
    where.boothId = options.boothId;
  }

  const lotteries = await prisma.lottery.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      booth: { select: { id: true, name: true, code: true } },
      prizeItems: {
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          name: true,
          quantity: true,
          remaining: true,
          probability: true,
        },
      },
      _count: { select: { entries: true, winners: true } },
    },
  });

  const lotteryIds = lotteries.map((lottery) => lottery.id);
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [todayGroups, sessions] = await Promise.all([
    lotteryIds.length
      ? prisma.lotteryEntry.groupBy({
          by: ["lotteryId"],
          where: {
            lotteryId: { in: lotteryIds },
            enteredAt: { gte: startOfToday },
          },
          _count: { _all: true },
        })
      : Promise.resolve([]),
    prisma.interactionSession.findMany({
      where: { eventId },
      select: { id: true, qrUrl: true, interactions: true },
    }),
  ]);

  const todayMap = new Map(
    todayGroups.map((group) => [group.lotteryId, group._count._all]),
  );
  const sessionMap = new Map<string, { sessionId: string; qrUrl: string | null }>();
  for (const session of sessions) {
    for (const ref of parseInteractionRefs(session.interactions)) {
      if (ref.type === "lottery" && ref.id && lotteryIds.includes(ref.id)) {
        sessionMap.set(ref.id, { sessionId: session.id, qrUrl: session.qrUrl });
      }
    }
  }

  return lotteries.map((lottery) => {
    const remaining_stock = resolveRemainingStock(lottery.prizeItems, lottery.prizes);
    const prize_count =
      lottery.prizeItems.reduce((sum, prize) => sum + prize.quantity, 0) ||
      resolveLegacyPrizeCount(lottery.prizes);
    const isOpen =
      lottery.status === LotteryStatus.OPEN ||
      lottery.status === LotteryStatus.ACTIVE;
    const sessionInfo = sessionMap.get(lottery.id);
    const prizes: ParticipantLotteryPrizeItem[] =
      lottery.prizeItems.length > 0
        ? lottery.prizeItems.map((prize) => ({
            id: prize.id,
            name: prize.name,
            quantity: prize.quantity,
            remaining: prize.remaining,
            probability_percent:
              prize.probability != null
                ? Math.round(Number(prize.probability) * 10000) / 100
                : null,
          }))
        : mapLegacyPrizeItems(lottery.prizes);

    return {
      id: lottery.id,
      title: lottery.title,
      status: lottery.status,
      lottery_category: lottery.lotteryCategory!,
      animation_type: lottery.animationType,
      trigger_action: lottery.triggerAction,
      owner_type: lottery.ownerType,
      booth: lottery.booth,
      entry_count: lottery._count.entries,
      winner_count: lottery._count.winners,
      prize_count,
      created_at: lottery.createdAt.toISOString(),
      created_by_id: lottery.createdById,
      today_entry_count: todayMap.get(lottery.id) ?? 0,
      remaining_stock,
      is_stock_depleted: isOpen && remaining_stock <= 0,
      prizes,
      is_mine: options.userId ? lottery.createdById === options.userId : false,
      session_id: sessionInfo?.sessionId ?? null,
      qr_url: sessionInfo?.qrUrl ?? null,
    };
  });
}

export async function replenishLotteryStock(
  lotteryId: string,
  addQuantity: number,
  session: AuthSession,
): Promise<{ remaining_stock: number }> {
  if (!Number.isFinite(addQuantity) || addQuantity <= 0) {
    throw new ApiError("补充数量无效", ErrorCode.VALIDATION_ERROR, 400);
  }

  const lottery = await prisma.lottery.findUnique({
    where: { id: lotteryId },
    include: {
      prizeItems: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!lottery) {
    throw new ApiError("抽奖不存在", ErrorCode.NOT_FOUND, 404);
  }

  await requireLotteryManageAccess(session, lottery.eventId, lottery);

  if (lottery.prizeItems.length > 0) {
    const primary = lottery.prizeItems[0]!;
    await prisma.lotteryPrize.update({
      where: { id: primary.id },
      data: {
        remaining: { increment: addQuantity },
        quantity: { increment: addQuantity },
      },
    });
  }

  if (
    lottery.status !== LotteryStatus.ACTIVE &&
    lottery.status !== LotteryStatus.OPEN
  ) {
    await prisma.lottery.update({
      where: { id: lotteryId },
      data: { status: LotteryStatus.ACTIVE },
    });
  }

  const updated = await prisma.lottery.findUnique({
    where: { id: lotteryId },
    include: { prizeItems: { select: { remaining: true, quantity: true } } },
  });
  const remaining_stock = resolveRemainingStock(
    updated?.prizeItems ?? [],
    updated?.prizes,
  );
  return { remaining_stock };
}

function mapLegacyPrizeItems(prizes: unknown): ParticipantLotteryPrizeItem[] {
  if (!Array.isArray(prizes)) return [];
  return prizes.map((raw, index) => {
    const prize = raw as {
      name?: string;
      prize?: string;
      count?: number;
      probability?: number;
    };
    const quantity = typeof prize.count === "number" ? prize.count : 1;
    const probability =
      typeof prize.probability === "number" ? prize.probability : null;
    return {
      name: prize.name ?? prize.prize ?? `奖品 ${index + 1}`,
      quantity,
      remaining: quantity,
      probability_percent:
        probability != null ? Math.round(probability * 10000) / 100 : null,
    };
  });
}

export type ListParticipantLotteriesOptions = {
  boothId?: string;
  ownerType?: "ORGANIZER" | "EXHIBITOR";
  categories?: LotteryCategory[];
};

export async function listParticipantLotteries(
  eventId: string,
  options: ListParticipantLotteriesOptions = {},
): Promise<ParticipantLotteryListItem[]> {
  const categories = options.categories?.length
    ? options.categories
    : [LotteryCategory.AUTO_PROBABILITY, LotteryCategory.INSTANT_CLAIM];

  const where: Prisma.LotteryWhereInput = {
    eventId,
    lotteryCategory: { in: categories },
  };

  if (options.boothId) {
    where.boothId = options.boothId;
  }

  if (options.ownerType === "ORGANIZER") {
    where.ownerType = "ORGANIZER";
    where.boothId = null;
  } else if (options.ownerType === "EXHIBITOR") {
    where.ownerType = "EXHIBITOR";
  }

  const lotteries = await prisma.lottery.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      booth: { select: { id: true, name: true, code: true } },
      prizeItems: {
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          name: true,
          quantity: true,
          remaining: true,
          probability: true,
        },
      },
      _count: { select: { entries: true, winners: true } },
    },
  });

  const lotteryIds = lotteries.map((lottery) => lottery.id);
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const todayGroups =
    lotteryIds.length > 0
      ? await prisma.lotteryEntry.groupBy({
          by: ["lotteryId"],
          where: {
            lotteryId: { in: lotteryIds },
            enteredAt: { gte: startOfToday },
          },
          _count: { _all: true },
        })
      : [];

  const todayMap = new Map(
    todayGroups.map((group) => [group.lotteryId, group._count._all]),
  );

  return lotteries.map((lottery) => {
    const remaining_stock = resolveRemainingStock(
      lottery.prizeItems,
      lottery.prizes,
    );
    const prize_count =
      lottery.prizeItems.reduce((sum, prize) => sum + prize.quantity, 0) ||
      resolveLegacyPrizeCount(lottery.prizes);
    const isOpen =
      lottery.status === LotteryStatus.OPEN ||
      lottery.status === LotteryStatus.ACTIVE;
    const prizes: ParticipantLotteryPrizeItem[] =
      lottery.prizeItems.length > 0
        ? lottery.prizeItems.map((prize) => ({
            id: prize.id,
            name: prize.name,
            quantity: prize.quantity,
            remaining: prize.remaining,
            probability_percent:
              prize.probability != null
                ? Math.round(Number(prize.probability) * 10000) / 100
                : null,
          }))
        : mapLegacyPrizeItems(lottery.prizes);

    return {
      id: lottery.id,
      title: lottery.title,
      status: lottery.status,
      lottery_category: lottery.lotteryCategory!,
      animation_type: lottery.animationType,
      trigger_action: lottery.triggerAction,
      owner_type: lottery.ownerType,
      booth: lottery.booth,
      entry_count: lottery._count.entries,
      winner_count: lottery._count.winners,
      prize_count,
      today_entry_count: todayMap.get(lottery.id) ?? 0,
      remaining_stock,
      is_stock_depleted: isOpen && remaining_stock <= 0,
      prizes,
      created_at: lottery.createdAt.toISOString(),
    };
  });
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
  options?: {
    viaScan?: boolean;
    guestProfile?: {
      name: string;
      company: string;
      job_title: string;
      phone: string;
    };
  },
) {
  const lottery = await getLotteryOrThrow(eventId, lotteryId);

  if (!isLotteryOpenForEntry(lottery.status)) {
    throw new ApiError("抽奖未开放参与", ErrorCode.VALIDATION_ERROR, 400);
  }

  const viaScan = options?.viaScan === true;
  let scanJoinAllowed = false;
  let eligibility: Awaited<
    ReturnType<
      typeof import("@/lib/lottery/organizer-lottery-service").loadOrganizerLotteryMeta
    >
  >["eligibility"] | null = null;

  if (viaScan) {
    const { loadOrganizerLotteryMeta } = await import(
      "@/lib/lottery/organizer-lottery-service"
    );
    const meta = await loadOrganizerLotteryMeta(
      eventId,
      lotteryId,
      lottery.bigScreenAnimationType,
    );
    eligibility = meta.eligibility;
    scanJoinAllowed = meta.eligibility.allow_scan_join === true;
    if (!scanJoinAllowed) {
      throw new ApiError("该抽奖未开启扫码加入", ErrorCode.FORBIDDEN, 403);
    }
  }

  if (lottery.requireCheckin && !scanJoinAllowed) {
    const checkedIn = await hasUserCheckedIn(eventId, userId);
    if (!checkedIn) {
      throw new ApiError("需要先完成签到才能参与", ErrorCode.FORBIDDEN, 403);
    }
  }

  if (lottery.requirePollId && !scanJoinAllowed) {
    const participated = await hasUserPollParticipation(
      eventId,
      userId,
      lottery.requirePollId,
    );
    if (!participated) {
      throw new ApiError("需要先参与指定互动才能抽奖", ErrorCode.FORBIDDEN, 403);
    }
  }

  if (lottery.eligibleRoles.length > 0 && !scanJoinAllowed) {
    const participant = await findParticipantForUser(eventId, userId);
    if (
      !participant ||
      !lottery.eligibleRoles.includes(participant.role)
    ) {
      throw new ApiError("不符合参与条件", ErrorCode.FORBIDDEN, 403);
    }
  }

  let leadData: Record<string, string> | undefined;

  if (viaScan && scanJoinAllowed && eligibility) {
    const {
      isRegisteredAttendee,
      upsertGuestParticipantForUser,
      ensureParticipantForUser,
    } = await import("@/lib/interaction/participant-user");

    const registered = await isRegisteredAttendee(eventId, userId);
    const guest = options?.guestProfile;
    const hasGuestProfile = Boolean(
      guest?.name?.trim() &&
        guest?.company?.trim() &&
        guest?.job_title?.trim() &&
        guest?.phone?.trim(),
    );

    if (!registered) {
      if (
        eligibility.require_registered_participant &&
        !eligibility.allow_guest_with_profile
      ) {
        throw new ApiError(
          "仅限本场参会者参与，请使用报名手机号登录",
          ErrorCode.FORBIDDEN,
          403,
        );
      }

      if (eligibility.allow_guest_with_profile) {
        if (!hasGuestProfile || !guest) {
          throw new ApiError(
            "请填写姓名、公司、职位与手机号后参与",
            ErrorCode.VALIDATION_ERROR,
            400,
          );
        }
        const phoneOk = /^1\d{10}$/.test(guest.phone.trim());
        if (!phoneOk) {
          throw new ApiError("请填写有效的11位手机号", ErrorCode.VALIDATION_ERROR, 400);
        }
        await upsertGuestParticipantForUser(eventId, userId, {
          name: guest.name.trim(),
          company: guest.company.trim(),
          jobTitle: guest.job_title.trim(),
          phone: guest.phone.trim(),
        });
        leadData = {
          name: guest.name.trim(),
          company: guest.company.trim(),
          job_title: guest.job_title.trim(),
          phone: guest.phone.trim(),
          join_as: "guest",
        };
      } else {
        await ensureParticipantForUser(eventId, userId);
      }
    } else {
      await ensureParticipantForUser(eventId, userId);
    }
  }

  try {
    const entry = await prisma.$transaction(async (tx) => {
      const created = await tx.lotteryEntry.create({
        data: {
          lotteryId,
          userId,
          source: viaScan && scanJoinAllowed ? "SCAN" : "MANUAL",
          ...(leadData
            ? { leadData: leadData as Prisma.InputJsonValue }
            : {}),
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

/** 类型③ 填表必得：有库存则发放，并挂载统一核销码 */
export async function claimInstantLotteryGift(
  lotteryId: string,
  userId: string,
  lead?: BoothLotteryLeadInput,
) {
  const lottery = await prisma.lottery.findUnique({
    where: { id: lotteryId },
    include: {
      booth: { select: { id: true, name: true, code: true } },
      prizeItems: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!lottery) {
    throw new ApiError("抽奖不存在", ErrorCode.NOT_FOUND, 404);
  }
  if (lottery.lotteryCategory !== LotteryCategory.INSTANT_CLAIM) {
    throw new ApiError("该抽奖不是直接领取类型", ErrorCode.VALIDATION_ERROR, 400);
  }
  if (!isLotteryOpenForEntry(lottery.status)) {
    throw new ApiError("抽奖未开放", ErrorCode.VALIDATION_ERROR, 400);
  }

  const eventId = lottery.eventId;
  const booth = lottery.booth;
  const pickupNote = booth
    ? `请至 ${booth.name}（${booth.code}）服务台领取奖品`
    : "请在活动结束前到服务台领取";

  if (booth) {
    await captureBoothLotteryLead(eventId, booth.id, userId, lead);
  }

  const existingWinner = await prisma.lotteryWinner.findFirst({
    where: { lotteryId, userId },
    orderBy: { wonAt: "desc" },
  });
  if (existingWinner) {
    const eventCode = existingWinner.eventCodeId
      ? await prisma.userEventCode.findUniqueOrThrow({
          where: { id: existingWinner.eventCodeId },
        })
      : await attachToEventCode(userId, eventId, existingWinner.id);

    return {
      lottery_id: lotteryId,
      won: true,
      prize_tier: existingWinner.prizeRank,
      prize_name: existingWinner.prizeName,
      redemption_code: formatEventCodeForScan(eventCode.code),
      pickup_note: pickupNote,
    };
  }

  try {
    await enterLottery(eventId, lotteryId, userId);
  } catch (err) {
    if (!(err instanceof ApiError && err.message === "您已参与过该抽奖")) {
      throw err;
    }
  }

  const availablePrizeItem = lottery.prizeItems.find((item) => item.remaining > 0);
  let prizeRank: number;
  let prizeName: string;
  let prizeId: string | null = null;

  if (lottery.prizeItems.length > 0) {
    if (!availablePrizeItem) {
      return {
        lottery_id: lotteryId,
        won: false,
        prize_tier: null,
        prize_name: null,
        redemption_code: null,
        pickup_note: "奖品已发完，感谢参与",
      };
    }
    prizeId = availablePrizeItem.id;
    prizeName = availablePrizeItem.name;
    prizeRank =
      lottery.prizeItems.findIndex((item) => item.id === availablePrizeItem.id) + 1;
  } else {
    const prizes = Array.isArray(lottery.prizes)
      ? (lottery.prizes as LotteryPrizeConfig[])
      : [];
    const winnerCounts = await prisma.lotteryWinner.groupBy({
      by: ["prizeRank"],
      where: { lotteryId },
      _count: { id: true },
    });
    const countMap = new Map(winnerCounts.map((row) => [row.prizeRank, row._count.id]));
    const available = prizes.filter(
      (prize) => (countMap.get(prize.rank) ?? 0) < (prize.count ?? 1),
    );
    if (available.length === 0) {
      return {
        lottery_id: lotteryId,
        won: false,
        prize_tier: null,
        prize_name: null,
        redemption_code: null,
        pickup_note: "奖品已发完，感谢参与",
      };
    }
    const picked = available[0]!;
    prizeRank = picked.rank;
    prizeName = picked.prize ?? picked.name;
  }

  const eventCode = await prisma.$transaction(async (tx) => {
    if (prizeId) {
      const updated = await tx.lotteryPrize.updateMany({
        where: { id: prizeId, remaining: { gt: 0 } },
        data: { remaining: { decrement: 1 } },
      });
      if (updated.count === 0) {
        throw new ApiError("奖品已发完", ErrorCode.VALIDATION_ERROR, 409);
      }
    }

    const winner = await tx.lotteryWinner.create({
      data: {
        lotteryId,
        userId,
        prizeId,
        prizeRank,
        prizeName,
      },
    });

    return attachToEventCode(userId, eventId, winner.id, tx);
  });

  return {
    lottery_id: lotteryId,
    won: true,
    prize_tier: prizeRank,
    prize_name: prizeName,
    redemption_code: formatEventCodeForScan(eventCode.code),
    pickup_note: pickupNote,
  };
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
  const winner = await prisma.lotteryWinner.create({
    data: {
      lotteryId: lottery.id,
      userId,
      prizeRank: picked.rank,
      prizeName,
    },
  });
  await attachToEventCode(userId, booth.eventId, winner.id);

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
      selected.map(async (entry) => {
        const row = await tx.lotteryWinner.create({
          data: {
            lotteryId,
            userId: entry.userId,
            prizeRank,
            prizeName,
          },
        });
        await attachToEventCode(entry.userId, eventId, row.id, tx);
        return row;
      }),
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
