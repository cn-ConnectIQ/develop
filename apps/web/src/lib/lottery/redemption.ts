import {
  InviteStatus,
  LotteryCategory,
  OrgStaffRole,
  prisma,
  ScanActionType,
  ScanResult,
  type Prisma,
  type UserEventCode,
} from "@connectiq/database";
import { ErrorCode } from "@connectiq/types";
import {
  ApiError,
  getSession,
  requireAuth,
  requireEventAccessCheck,
} from "@/lib/api-auth";
import {
  formatEventCodeForScan,
  parseEventCodeFromScan,
} from "@/lib/event-code";
import {
  requireMobileEventAccess,
  resolveMobileUserId,
} from "@/lib/mobile-user-id";

type DbClient = Prisma.TransactionClient | typeof prisma;

function formatVerifiedTime(date: Date | null | undefined): string {
  if (!date) return "—";
  return date.toLocaleString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    month: "numeric",
    day: "numeric",
  });
}

function resolveAvatarUrl(name: string): string {
  return `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name.slice(0, 1) || "?")}`;
}

function resolveVerifyActionType(
  lotteryCategory: LotteryCategory,
): ScanActionType {
  return lotteryCategory === LotteryCategory.INSTANT_CLAIM
    ? ScanActionType.GIFT_VERIFY
    : ScanActionType.LOTTERY_VERIFY;
}

async function logCodeScan(
  params: {
    codeId: string;
    actionType: ScanActionType;
    actionRef: string | null;
    result: ScanResult;
    operatorId: string;
  },
  db: DbClient = prisma,
) {
  await db.codeScanLog.create({ data: params });
}

/** 查找或创建用户在某活动下的一码通（一人一场活动一个码） */
export async function upsertUserEventCode(
  userId: string,
  eventId: string,
  db: DbClient = prisma,
): Promise<UserEventCode> {
  return db.userEventCode.upsert({
    where: { eventId_userId: { eventId, userId } },
    create: { eventId, userId },
    update: {},
  });
}

/** @deprecated 使用 upsertUserEventCode */
export const upsertUserRedemptionCode = upsertUserEventCode;

/** 中奖记录挂载到一码通（开奖/领取流程内部调用） */
export async function attachToEventCode(
  userId: string,
  eventId: string,
  lotteryWinnerId: string,
  db: DbClient = prisma,
): Promise<UserEventCode> {
  const code = await upsertUserEventCode(userId, eventId, db);
  await db.lotteryWinner.update({
    where: { id: lotteryWinnerId },
    data: { eventCodeId: code.id },
  });
  return code;
}

/** @deprecated 使用 attachToEventCode */
export const attachToRedemptionCode = attachToEventCode;

export type MyRedemptionCodeResult = {
  code: string;
  hasUnclaimedPrizes: boolean;
  unclaimedCount: number;
};

/** 获取/创建当前用户的一码通（返回 CIQ: 前缀格式供扫码） */
export async function getMyRedemptionCode(
  userId: string,
  eventId: string,
): Promise<MyRedemptionCodeResult> {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true },
  });
  if (!event) {
    throw new ApiError("活动不存在", ErrorCode.NOT_FOUND, 404);
  }

  const eventCode = await upsertUserEventCode(userId, eventId);

  const unclaimedCount = await prisma.lotteryWinner.count({
    where: {
      userId,
      verified: false,
      lottery: { eventId },
    },
  });

  return {
    code: formatEventCodeForScan(eventCode.code),
    hasUnclaimedPrizes: unclaimedCount > 0,
    unclaimedCount,
  };
}

export type RedemptionPrizeView = {
  winnerId: string;
  prizeName: string;
  prizeImage: string | null;
  lotteryTitle: string;
  lotteryCategory: string;
  wonAt: string;
  verified: boolean;
  verifiedAt: string | null;
};

export type RedemptionLookupResult = {
  eventId: string;
  user: {
    name: string;
    company: string | null;
    avatar: string;
  };
  prizes: RedemptionPrizeView[];
};

async function hasEventBoothStaffAccess(
  userId: string,
  eventId: string,
): Promise<boolean> {
  const booth = await prisma.exhibitorBooth.findFirst({
    where: {
      eventId,
      OR: [
        { operatorUserId: userId },
        {
          companyOrg: {
            staff: {
              some: {
                userId,
                status: InviteStatus.ACCEPTED,
                role: {
                  in: [
                    OrgStaffRole.OWNER,
                    OrgStaffRole.ADMIN,
                    OrgStaffRole.OPERATOR,
                  ],
                },
              },
            },
          },
        },
      ],
    },
    select: { id: true },
  });
  return !!booth;
}

/** 核销台权限：活动主办方 或 该活动下展位工作人员 */
export async function requireRedemptionStaffAccess(
  request: Request,
  eventId: string,
): Promise<{ userId: string }> {
  const eventCheck = await requireEventAccessCheck(eventId);
  if (!("error" in eventCheck)) {
    return { userId: eventCheck.session.user.id };
  }

  try {
    const mobile = await requireMobileEventAccess(request, eventId);
    return { userId: mobile.userId };
  } catch {
    // 继续尝试展位工作人员
  }

  let userId: string;
  try {
    userId = await resolveMobileUserId(request);
  } catch {
    try {
      const { user } = await requireAuth();
      userId = user.id;
    } catch {
      throw new ApiError("未登录", ErrorCode.UNAUTHORIZED, 401);
    }
  }

  if (await hasEventBoothStaffAccess(userId, eventId)) {
    return { userId };
  }

  throw new ApiError("无权核销", ErrorCode.FORBIDDEN, 403);
}

/** 核销台页面权限：活动主办方 或 展位工作人员 */
export async function requireRedemptionPageAccess(
  eventId: string,
): Promise<boolean> {
  const eventCheck = await requireEventAccessCheck(eventId);
  if (!("error" in eventCheck)) {
    return true;
  }

  const session = await getSession();
  if (session?.user?.id && (await hasEventBoothStaffAccess(session.user.id, eventId))) {
    return true;
  }

  return false;
}

/** 核销台扫码查询：该码对应用户在本活动下的全部中奖记录 */
export async function lookupRedemptionCode(
  rawCode: string,
): Promise<RedemptionLookupResult> {
  const code = parseEventCodeFromScan(rawCode);
  if (!code) {
    throw new ApiError("核销码无效", ErrorCode.VALIDATION_ERROR, 400);
  }

  const eventCode = await prisma.userEventCode.findUnique({
    where: { code },
    include: {
      user: {
        select: {
          name: true,
          profile: { select: { company: true } },
        },
      },
    },
  });

  if (!eventCode) {
    throw new ApiError("核销码无效", ErrorCode.NOT_FOUND, 404);
  }

  const winners = await prisma.lotteryWinner.findMany({
    where: {
      userId: eventCode.userId,
      lottery: { eventId: eventCode.eventId },
    },
    include: {
      prize: { select: { name: true, imageUrl: true } },
      lottery: { select: { title: true, lotteryCategory: true } },
    },
    orderBy: [{ verified: "asc" }, { wonAt: "desc" }],
  });

  return {
    eventId: eventCode.eventId,
    user: {
      name: eventCode.user.name,
      company: eventCode.user.profile?.company ?? null,
      avatar: resolveAvatarUrl(eventCode.user.name),
    },
    prizes: winners.map((winner) => ({
      winnerId: winner.id,
      prizeName: winner.prize?.name ?? winner.prizeName,
      prizeImage: winner.prize?.imageUrl ?? null,
      lotteryTitle: winner.lottery.title,
      lotteryCategory: winner.lottery.lotteryCategory,
      wonAt: winner.wonAt.toISOString(),
      verified: winner.verified,
      verifiedAt: winner.verifiedAt?.toISOString() ?? null,
    })),
  };
}

/** 单个奖品核销 */
export async function verifyRedemptionWinner(
  rawCode: string,
  winnerId: string,
  verifierUserId: string,
) {
  const code = parseEventCodeFromScan(rawCode);
  if (!code) {
    throw new ApiError("核销码无效", ErrorCode.VALIDATION_ERROR, 400);
  }

  const eventCode = await prisma.userEventCode.findUnique({
    where: { code },
    select: { id: true, eventId: true, userId: true },
  });
  if (!eventCode) {
    throw new ApiError("核销码无效", ErrorCode.NOT_FOUND, 404);
  }

  const winner = await prisma.lotteryWinner.findFirst({
    where: {
      id: winnerId,
      userId: eventCode.userId,
      lottery: { eventId: eventCode.eventId },
    },
    include: {
      prize: { select: { name: true, imageUrl: true } },
      lottery: { select: { title: true, lotteryCategory: true } },
    },
  });

  const actionType = winner
    ? resolveVerifyActionType(winner.lottery.lotteryCategory)
    : ScanActionType.LOTTERY_VERIFY;

  if (!winner) {
    await logCodeScan({
      codeId: eventCode.id,
      actionType,
      actionRef: winnerId,
      result: ScanResult.INVALID,
      operatorId: verifierUserId,
    });
    throw new ApiError("中奖记录不存在", ErrorCode.NOT_FOUND, 404);
  }

  if (winner.verified) {
    await logCodeScan({
      codeId: eventCode.id,
      actionType: resolveVerifyActionType(winner.lottery.lotteryCategory),
      actionRef: winnerId,
      result: ScanResult.DUPLICATE,
      operatorId: verifierUserId,
    });
    throw new ApiError(
      `该奖品已于 ${formatVerifiedTime(winner.verifiedAt)} 核销`,
      ErrorCode.VALIDATION_ERROR,
      409,
    );
  }

  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.lotteryWinner.update({
      where: { id: winner.id },
      data: {
        verified: true,
        verifiedAt: new Date(),
        verifiedBy: verifierUserId,
        eventCodeId: eventCode.id,
      },
      include: {
        prize: { select: { name: true, imageUrl: true } },
        lottery: { select: { title: true, lotteryCategory: true } },
      },
    });

    await logCodeScan(
      {
        codeId: eventCode.id,
        actionType: resolveVerifyActionType(row.lottery.lotteryCategory),
        actionRef: winnerId,
        result: ScanResult.SUCCESS,
        operatorId: verifierUserId,
      },
      tx,
    );

    return row;
  });

  return {
    winnerId: updated.id,
    prizeName: updated.prize?.name ?? updated.prizeName,
    prizeImage: updated.prize?.imageUrl ?? null,
    lotteryTitle: updated.lottery.title,
    lotteryCategory: updated.lottery.lotteryCategory,
    wonAt: updated.wonAt.toISOString(),
    verified: updated.verified,
    verifiedAt: updated.verifiedAt?.toISOString() ?? null,
  };
}

export type RedemptionLogView = {
  id: string;
  verifiedAt: string;
  attendeeName: string;
  attendeeCompany: string | null;
  prizeName: string;
  lotteryTitle: string;
  verifierName: string | null;
};

/** 今日核销记录（活动维度） */
export async function getTodayRedemptionLogs(
  eventId: string,
): Promise<RedemptionLogView[]> {
  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);

  const winners = await prisma.lotteryWinner.findMany({
    where: {
      verified: true,
      verifiedAt: { gte: startOfDay, lte: endOfDay },
      lottery: { eventId },
    },
    include: {
      user: {
        select: {
          name: true,
          profile: { select: { company: true } },
        },
      },
      prize: { select: { name: true } },
      lottery: { select: { title: true } },
      verifier: { select: { name: true } },
    },
    orderBy: { verifiedAt: "desc" },
  });

  return winners.map((winner) => ({
    id: winner.id,
    verifiedAt: winner.verifiedAt!.toISOString(),
    attendeeName: winner.user.name,
    attendeeCompany: winner.user.profile?.company ?? null,
    prizeName: winner.prize?.name ?? winner.prizeName,
    lotteryTitle: winner.lottery.title,
    verifierName: winner.verifier?.name ?? null,
  }));
}
