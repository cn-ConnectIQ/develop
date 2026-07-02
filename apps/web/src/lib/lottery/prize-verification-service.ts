import { prisma } from "@connectiq/database";
import { ErrorCode } from "@connectiq/types";
import { ApiError } from "@/lib/api-auth";
import { extractVerificationCode } from "@/lib/lottery/prize-verification-utils";

export type VerificationLookupResult =
  | { status: "invalid" }
  | {
      status: "already_redeemed";
      winner: VerificationWinnerView;
      stats: VerificationStats;
    }
  | {
      status: "valid";
      winner: VerificationWinnerView;
      stats: VerificationStats;
    };

export type VerificationWinnerView = {
  id: string;
  user_id: string;
  name: string;
  company: string | null;
  prize_name: string;
  prize_rank: number;
  lottery_id: string;
  lottery_title: string;
  booth_code: string | null;
  won_at: string;
  verified_at: string | null;
  verifier_name: string | null;
};

export type VerificationStats = {
  redeemed_count: number;
  pending_count: number;
  total_winners: number;
};

async function loadWinnerByCode(code: string) {
  return prisma.lotteryWinner.findUnique({
    where: { verificationCode: code },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          profile: { select: { company: true } },
        },
      },
      verifier: { select: { id: true, name: true } },
      lottery: {
        select: {
          id: true,
          title: true,
          eventId: true,
          booth: { select: { code: true } },
        },
      },
    },
  });
}

export async function getEventVerificationStats(
  eventId: string,
): Promise<VerificationStats> {
  const winners = await prisma.lotteryWinner.findMany({
    where: {
      lottery: { eventId },
      verificationCode: { not: null },
    },
    select: { verified: true },
  });

  const redeemed_count = winners.filter((w) => w.verified).length;
  const pending_count = winners.length - redeemed_count;

  return {
    redeemed_count,
    pending_count,
    total_winners: winners.length,
  };
}

function mapWinnerView(
  row: NonNullable<Awaited<ReturnType<typeof loadWinnerByCode>>>,
): VerificationWinnerView {
  return {
    id: row.id,
    user_id: row.userId,
    name: row.user.name,
    company: row.user.profile?.company ?? null,
    prize_name: row.prizeName,
    prize_rank: row.prizeRank,
    lottery_id: row.lottery.id,
    lottery_title: row.lottery.title,
    booth_code: row.lottery.booth?.code ?? null,
    won_at: row.wonAt.toISOString(),
    verified_at: row.verifiedAt?.toISOString() ?? null,
    verifier_name: row.verifier?.name ?? null,
  };
}

export async function lookupVerificationCode(
  rawCode: string,
  eventId: string,
): Promise<VerificationLookupResult> {
  const code = extractVerificationCode(rawCode);
  if (!code) {
    return { status: "invalid" };
  }

  const winner = await loadWinnerByCode(code);
  if (!winner || !winner.verificationCode) {
    return { status: "invalid" };
  }

  if (winner.lottery.eventId !== eventId) {
    return { status: "invalid" };
  }

  const stats = await getEventVerificationStats(eventId);
  const winnerView = mapWinnerView(winner);

  if (winner.verified) {
    return {
      status: "already_redeemed",
      winner: winnerView,
      stats,
    };
  }

  return {
    status: "valid",
    winner: winnerView,
    stats,
  };
}

export async function redeemVerificationCode(
  rawCode: string,
  eventId: string,
  verifierUserId: string,
) {
  const code = extractVerificationCode(rawCode);
  if (!code) {
    throw new ApiError("核销码无效", ErrorCode.VALIDATION_ERROR, 400);
  }

  const winner = await loadWinnerByCode(code);
  if (!winner || !winner.verificationCode) {
    throw new ApiError("核销码无效", ErrorCode.NOT_FOUND, 404);
  }

  if (winner.lottery.eventId !== eventId) {
    throw new ApiError("该核销码不属于本活动", ErrorCode.FORBIDDEN, 403);
  }

  if (winner.verified) {
    throw new ApiError(
      `已于 ${formatTime(winner.verifiedAt)} 核销`,
      ErrorCode.VALIDATION_ERROR,
      409,
    );
  }

  const updated = await prisma.lotteryWinner.update({
    where: { id: winner.id },
    data: {
      verified: true,
      verifiedAt: new Date(),
      verifiedBy: verifierUserId,
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          profile: { select: { company: true } },
        },
      },
      verifier: { select: { id: true, name: true } },
      lottery: {
        select: {
          id: true,
          title: true,
          eventId: true,
          booth: { select: { code: true } },
        },
      },
    },
  });

  const stats = await getEventVerificationStats(eventId);

  return {
    success: true,
    winner: mapWinnerView(updated),
    stats,
  };
}

function formatTime(date: Date | null | undefined) {
  if (!date) return "—";
  return date.toLocaleString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    month: "numeric",
    day: "numeric",
  });
}
