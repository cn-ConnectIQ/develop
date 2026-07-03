import {
  LotteryCategory,
  ScanActionType,
  ScanResult,
  prisma,
} from "@connectiq/database";
import {
  filterPendingPrizesForOperator,
  resolveScanOperatorRole,
} from "@/lib/scan/permissions";
import type { ScanHandlerContext, ScanHandlerOutcome } from "@/lib/scan/types";

function formatVerifiedTime(date: Date | null | undefined): string {
  if (!date) return "—";
  return date.toLocaleString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    month: "numeric",
    day: "numeric",
  });
}

type PendingPrizeView = {
  winnerId: string;
  prizeName: string;
  prizeImage: string | null;
  lotteryTitle: string;
  lotteryCategory: string;
  wonAt: string;
};

type PendingPrizeRow = PendingPrizeView & {
  lotteryBoothId: string | null;
};

async function listPendingPrizes(
  eventId: string,
  userId: string,
  operatorId: string,
): Promise<PendingPrizeView[]> {
  const winners = await prisma.lotteryWinner.findMany({
    where: {
      userId,
      verified: false,
      lottery: { eventId },
    },
    include: {
      prize: { select: { name: true, imageUrl: true } },
      lottery: {
        select: { title: true, lotteryCategory: true, boothId: true },
      },
    },
    orderBy: { wonAt: "desc" },
  });

  const rows: PendingPrizeRow[] = winners.map((w) => ({
    winnerId: w.id,
    prizeName: w.prize?.name ?? w.prizeName,
    prizeImage: w.prize?.imageUrl ?? null,
    lotteryTitle: w.lottery.title,
    lotteryCategory: w.lottery.lotteryCategory,
    wonAt: w.wonAt.toISOString(),
    lotteryBoothId: w.lottery.boothId,
  }));

  const allowedIds = await filterPendingPrizesForOperator(
    operatorId,
    eventId,
    rows.map((r) => ({
      winnerId: r.winnerId,
      lotteryBoothId: r.lotteryBoothId,
    })),
  );

  return rows
    .filter((r) => allowedIds.includes(r.winnerId))
    .map(({ lotteryBoothId: _b, ...rest }) => rest);
}

type PrizeVerifyAction =
  (typeof ScanActionType)["LOTTERY_VERIFY"] |
  (typeof ScanActionType)["GIFT_VERIFY"];

export async function handlePrizeVerifyScan(
  ctx: ScanHandlerContext,
  action: PrizeVerifyAction,
): Promise<ScanHandlerOutcome> {
  const winnerId = ctx.actionRef?.trim();

  if (!winnerId) {
    const pendingPrizes = await listPendingPrizes(
      ctx.eventId,
      ctx.attendeeUserId,
      ctx.operatorId,
    );

    if (pendingPrizes.length === 0) {
      const role = await resolveScanOperatorRole(
        ctx.operatorId,
        ctx.eventId,
      );
      return {
        result: ScanResult.INVALID,
        message:
          role === "EXHIBITOR" ? "暂无本展位待核销奖品" : "暂无待核销奖品",
        actionDetail: { pendingPrizes: [] },
      };
    }

    return {
      result: ScanResult.SUCCESS,
      message: `共 ${pendingPrizes.length} 个待核销奖品，请选择`,
      actionDetail: { pendingPrizes },
    };
  }

  const winner = await prisma.lotteryWinner.findFirst({
    where: {
      id: winnerId,
      userId: ctx.attendeeUserId,
      lottery: { eventId: ctx.eventId },
    },
    include: {
      prize: { select: { name: true, imageUrl: true } },
      lottery: {
        select: { title: true, lotteryCategory: true, boothId: true },
      },
    },
  });

  if (!winner) {
    return {
      result: ScanResult.INVALID,
      message: "中奖记录不存在",
    };
  }

  if (action === ScanActionType.GIFT_VERIFY) {
    if (winner.lottery.lotteryCategory !== LotteryCategory.INSTANT_CLAIM) {
      return {
        result: ScanResult.INVALID,
        message: "该奖品不是礼品核销类型",
      };
    }
  } else if (winner.lottery.lotteryCategory === LotteryCategory.INSTANT_CLAIM) {
    return {
      result: ScanResult.INVALID,
      message: "请使用礼品核销动作",
    };
  }

  if (winner.verified) {
    return {
      result: ScanResult.DUPLICATE,
      message: `该奖品已于 ${formatVerifiedTime(winner.verifiedAt)} 核销`,
      actionDetail: {
        winnerId: winner.id,
        prizeName: winner.prize?.name ?? winner.prizeName,
        verifiedAt: winner.verifiedAt?.toISOString() ?? null,
      },
    };
  }

  const updated = await prisma.lotteryWinner.updateMany({
    where: { id: winner.id, verified: false },
    data: {
      verified: true,
      verifiedAt: new Date(),
      verifiedBy: ctx.operatorId,
      eventCodeId: ctx.codeId,
    },
  });

  if (updated.count === 0) {
    const current = await prisma.lotteryWinner.findUnique({
      where: { id: winner.id },
      select: { verified: true, verifiedAt: true },
    });
    return {
      result: ScanResult.DUPLICATE,
      message: current?.verified
        ? `该奖品已于 ${formatVerifiedTime(current.verifiedAt)} 核销`
        : "该奖品已核销",
      actionDetail: {
        winnerId: winner.id,
        prizeName: winner.prize?.name ?? winner.prizeName,
        verifiedAt: current?.verifiedAt?.toISOString() ?? null,
      },
    };
  }

  const row = await prisma.lotteryWinner.findUniqueOrThrow({
    where: { id: winner.id },
    include: {
      prize: { select: { name: true, imageUrl: true } },
      lottery: { select: { title: true, lotteryCategory: true } },
    },
  });

  return {
    result: ScanResult.SUCCESS,
    message: `已核销 · ${row.prize?.name ?? row.prizeName}`,
    actionDetail: {
      winnerId: row.id,
      prizeName: row.prize?.name ?? row.prizeName,
      prizeImage: row.prize?.imageUrl ?? null,
      lotteryTitle: row.lottery.title,
      lotteryCategory: row.lottery.lotteryCategory,
      verifiedAt: row.verifiedAt?.toISOString() ?? null,
    },
  };
}
