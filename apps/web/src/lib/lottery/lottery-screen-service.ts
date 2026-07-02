import {
  LotteryOwnerType,
  LotteryStatus,
  prisma,
} from "@connectiq/database";
import { ErrorCode } from "@connectiq/types";
import { ApiError } from "@/lib/api-auth";
import { fisherYatesShuffle } from "@/lib/interaction/lottery-rewards";
import { isLotteryOpenForEntry } from "@/lib/lottery/booth-lottery-service";
import { loadOrganizerLotteryMeta } from "@/lib/lottery/organizer-lottery-service";
import {
  broadcastLotteryScreenMessage,
  type LotteryScreenRollingEntry,
  type LotteryScreenStartData,
  type LotteryScreenWinnerPayload,
} from "@/lib/realtime/lottery-screen";

function generateVerificationCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

async function getOrganizerLotteryOrThrow(eventId: string, lotteryId: string) {
  const lottery = await prisma.lottery.findFirst({
    where: {
      id: lotteryId,
      eventId,
      ownerType: LotteryOwnerType.ORGANIZER,
      boothId: null,
    },
    include: {
      prizeItems: { orderBy: { sortOrder: "asc" } },
      _count: { select: { entries: true, winners: true } },
    },
  });

  if (!lottery) {
    throw new ApiError("全场抽奖不存在", ErrorCode.NOT_FOUND, 404);
  }

  return lottery;
}

function resolveAvatarSeed(name: string) {
  return encodeURIComponent(name.slice(0, 1) || "?");
}

export async function startLotteryScreen(eventId: string, lotteryId: string) {
  const lottery = await getOrganizerLotteryOrThrow(eventId, lotteryId);
  const meta = await loadOrganizerLotteryMeta(eventId, lotteryId);

  if (
    lottery.status !== LotteryStatus.OPEN &&
    lottery.status !== LotteryStatus.DRAWING
  ) {
    throw new ApiError("抽奖未开放，无法启动大屏", ErrorCode.VALIDATION_ERROR, 400);
  }

  const entries = await prisma.lotteryEntry.findMany({
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
  });

  if (entries.length === 0) {
    throw new ApiError("暂无报名参与者", ErrorCode.VALIDATION_ERROR, 400);
  }

  if (isLotteryOpenForEntry(lottery.status)) {
    await prisma.lottery.update({
      where: { id: lotteryId },
      data: { status: LotteryStatus.DRAWING },
    });
  }

  const rolling_entries: LotteryScreenRollingEntry[] = entries.map((e) => ({
    id: e.userId,
    name: e.user.name,
    company: e.user.profile?.company ?? null,
  }));

  const prizes =
    lottery.prizeItems.length > 0
      ? lottery.prizeItems.map((p, index) => ({
          rank: index + 1,
          name: p.name,
          quantity: p.quantity,
        }))
      : [];

  const data: LotteryScreenStartData = {
    lottery_id: lotteryId,
    title: lottery.title,
    animation: meta.screen_animation,
    entry_count: entries.length,
    rolling_entries,
    prizes,
  };

  const sent = await broadcastLotteryScreenMessage(eventId, {
    type: "START_ANIMATION",
    data,
  });

  return { sent, lottery: data, status: LotteryStatus.DRAWING };
}

export async function revealNextLotteryScreenWinner(
  eventId: string,
  lotteryId: string,
) {
  const lottery = await getOrganizerLotteryOrThrow(eventId, lotteryId);

  if (
    lottery.status !== LotteryStatus.DRAWING &&
    lottery.status !== LotteryStatus.OPEN
  ) {
    throw new ApiError("请先启动大屏抽奖动画", ErrorCode.VALIDATION_ERROR, 400);
  }

  if (lottery.status === LotteryStatus.OPEN) {
    await prisma.lottery.update({
      where: { id: lotteryId },
      data: { status: LotteryStatus.DRAWING },
    });
  }

  const prizeItems = lottery.prizeItems;
  if (prizeItems.length === 0) {
    throw new ApiError("未配置奖品", ErrorCode.VALIDATION_ERROR, 400);
  }

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
      select: { id: true, userId: true, prizeId: true, prizeRank: true },
    }),
  ]);

  const winnerUserIds = new Set(existingWinners.map((w) => w.userId));
  const pool = entries.filter((e) => !winnerUserIds.has(e.userId));

  if (pool.length === 0) {
    throw new ApiError("奖池中没有可抽取的参与者", ErrorCode.VALIDATION_ERROR, 400);
  }

  let targetPrize: (typeof prizeItems)[number] | null = null;
  for (const prize of prizeItems) {
    const drawnForPrize = existingWinners.filter(
      (w) => w.prizeId === prize.id || w.prizeRank === prize.sortOrder + 1,
    ).length;
    if (drawnForPrize < prize.quantity) {
      targetPrize = prize;
      break;
    }
  }

  if (!targetPrize) {
    const totalWinners = existingWinners.length;
    await prisma.lottery.update({
      where: { id: lotteryId },
      data: { status: LotteryStatus.FINISHED, drawnAt: new Date() },
    });
    await broadcastLotteryScreenMessage(eventId, {
      type: "END",
      data: { lottery_id: lotteryId, total_winners: totalWinners },
    });
    throw new ApiError("全部奖品已揭晓", ErrorCode.VALIDATION_ERROR, 400);
  }

  const shuffled = fisherYatesShuffle(pool);
  const picked = shuffled[0]!;

  let verificationCode = generateVerificationCode();
  for (let attempt = 0; attempt < 5; attempt++) {
    const exists = await prisma.lotteryWinner.findUnique({
      where: { verificationCode },
      select: { id: true },
    });
    if (!exists) break;
    verificationCode = generateVerificationCode();
  }

  const prizeRank = targetPrize.sortOrder + 1;
  const winnerRow = await prisma.lotteryWinner.create({
    data: {
      lotteryId,
      userId: picked.userId,
      entryId: picked.id,
      prizeId: targetPrize.id,
      prizeRank,
      prizeName: targetPrize.name,
      verificationCode,
    },
  });

  const winnerQuota = prizeItems.reduce((sum, p) => sum + p.quantity, 0);
  const revealedTotal = existingWinners.length + 1;

  const winner: LotteryScreenWinnerPayload = {
    id: winnerRow.id,
    user_id: picked.userId,
    name: picked.user.name,
    company: picked.user.profile?.company ?? null,
    prize_name: targetPrize.name,
    prize_rank: prizeRank,
    verification_code: verificationCode,
    pickup_note: "请凭核销码至领奖台领取奖品",
  };

  if (revealedTotal >= winnerQuota) {
    await prisma.lottery.update({
      where: { id: lotteryId },
      data: { status: LotteryStatus.FINISHED, drawnAt: new Date() },
    });
  }

  const sent = await broadcastLotteryScreenMessage(eventId, {
    type: "REVEAL_WINNER",
    data: {
      lottery_id: lotteryId,
      winner,
      revealed_total: revealedTotal,
      winner_quota: winnerQuota,
    },
  });

  return {
    sent,
    winner,
    revealed_total: revealedTotal,
    winner_quota: winnerQuota,
    finished: revealedTotal >= winnerQuota,
  };
}

export async function endLotteryScreen(eventId: string, lotteryId: string) {
  await getOrganizerLotteryOrThrow(eventId, lotteryId);

  const totalWinners = await prisma.lotteryWinner.count({
    where: { lotteryId },
  });

  await prisma.lottery.update({
    where: { id: lotteryId },
    data: { status: LotteryStatus.FINISHED, drawnAt: new Date() },
  });

  const sent = await broadcastLotteryScreenMessage(eventId, {
    type: "END",
    data: { lottery_id: lotteryId, total_winners: totalWinners },
  });

  return { sent, total_winners: totalWinners };
}

export async function getLotteryScreenState(eventId: string, lotteryId: string) {
  const lottery = await getOrganizerLotteryOrThrow(eventId, lotteryId);
  const meta = await loadOrganizerLotteryMeta(eventId, lotteryId);

  const winners = await prisma.lotteryWinner.findMany({
    where: { lotteryId },
    orderBy: [{ prizeRank: "asc" }, { drawnAt: "asc" }],
    include: {
      user: {
        select: {
          id: true,
          name: true,
          profile: { select: { company: true } },
        },
      },
    },
  });

  const winnerQuota = lottery.prizeItems.reduce((sum, p) => sum + p.quantity, 0);

  return {
    lottery: {
      id: lottery.id,
      title: lottery.title,
      status: lottery.status,
      draw_at: lottery.drawAt?.toISOString() ?? null,
      entry_count: lottery._count.entries,
      animation: meta.screen_animation,
    },
    winner_quota: winnerQuota,
    revealed_count: winners.length,
    winners: winners.map((w) => ({
      id: w.id,
      user_id: w.userId,
      name: w.user.name,
      company: w.user.profile?.company ?? null,
      prize_name: w.prizeName,
      prize_rank: w.prizeRank,
      verification_code: w.verificationCode,
      pickup_note: "请凭核销码至领奖台领取奖品",
      avatar_url: `https://api.dicebear.com/7.x/initials/svg?seed=${resolveAvatarSeed(w.user.name)}`,
      drawn_at: w.drawnAt.toISOString(),
    })),
  };
}
