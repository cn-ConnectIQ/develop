import {
  LotteryOwnerType,
  LotteryStatus,
  prisma,
} from "@connectiq/database";
import { ErrorCode } from "@connectiq/types";
import { ApiError } from "@/lib/api-auth";
import { fisherYatesShuffle } from "@/lib/interaction/lottery-rewards";
import { isLotteryOpenForEntry } from "@/lib/lottery/booth-lottery-service";
import { attachToRedemptionCode, ensureEventCodesForUsers } from "@/lib/lottery/redemption";
import {
  loadOrganizerLotteryMeta,
  patchOrganizerLotteryDrawMeta,
  ensureOrganizerLotteryScanSession,
  resolveOrganizerLotteryScanJoin,
  syncOrganizerLotteryEntriesFromEligibility,
} from "@/lib/lottery/organizer-lottery-service";
import {
  bigScreenToLegacyAnimation,
} from "@/lib/lottery/big-screen-animation-config";
import {
  tierLabel,
  type PrizeDrawOrder,
} from "@/lib/lottery/organizer-lottery-config";
import {
  broadcastLotteryScreenMessage,
  type LotteryScreenRollingEntry,
  type LotteryScreenStartData,
  type LotteryScreenWinnerPayload,
} from "@/lib/realtime/lottery-screen";

export type TierDrawMode = "ONE" | "ALL";

export type TierDrawWinnerResult = {
  winnerId: string;
  userId: string;
  name: string;
  avatar: string;
  company: string | null;
  verification_code: string | null;
};

export type DrawTierWinnersResult = {
  sent: boolean;
  tier: number;
  tier_label: string;
  prizeName: string;
  quantity: number;
  thisDrawWinners: TierDrawWinnerResult[];
  totalDrawnCount: number;
  remainingCount: number;
  tier_complete: boolean;
  revealed_total: number;
  winner_quota: number;
  finished: boolean;
};

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

type PrizeItem = {
  id: string;
  name: string;
  quantity: number;
  sortOrder: number;
  tier: number | null;
};

function resolvePrizeTier(p: { tier: number | null; sortOrder: number }) {
  return p.tier ?? p.sortOrder + 1;
}

function sortPrizesForDraw(prizeItems: PrizeItem[], drawOrder: PrizeDrawOrder) {
  const mapped = prizeItems.map((p) => ({
    ...p,
    resolvedTier: resolvePrizeTier(p),
  }));
  if (drawOrder === "ASC") {
    return [...mapped].sort((a, b) => b.resolvedTier - a.resolvedTier);
  }
  return [...mapped].sort((a, b) => a.resolvedTier - b.resolvedTier);
}

export type LotteryTierState = {
  tier: number;
  label: string;
  prize_id: string;
  prize_name: string;
  quantity: number;
  drawn_count: number;
  complete: boolean;
  is_next: boolean;
  is_active: boolean;
};

export function buildTierStates(
  prizeItems: PrizeItem[],
  winners: Array<{ prizeId: string | null; prizeRank: number }>,
  drawOrder: PrizeDrawOrder,
  activeTier: number | null,
): LotteryTierState[] {
  const drawSequence = sortPrizesForDraw(prizeItems, drawOrder);
  const states: LotteryTierState[] = drawSequence.map((p) => {
    const tier = p.resolvedTier;
    const drawn_count = winners.filter(
      (w) => w.prizeId === p.id || w.prizeRank === tier,
    ).length;
    return {
      tier,
      label: tierLabel(tier),
      prize_id: p.id,
      prize_name: p.name,
      quantity: p.quantity,
      drawn_count,
      complete: drawn_count >= p.quantity,
      is_next: false,
      is_active: activeTier === tier,
    };
  });

  const nextIncomplete = states.find((s) => !s.complete);
  if (nextIncomplete && activeTier == null) {
    nextIncomplete.is_next = true;
  }

  return states;
}

async function drawWinnersForPrize(
  eventId: string,
  lotteryId: string,
  targetPrize: PrizeItem,
  drawCount: number,
  entries: Array<{
    id: string;
    userId: string;
    user: { name: string; profile: { company: string | null } | null };
  }>,
  existingWinners: Array<{ userId: string }>,
) {
  if (drawCount <= 0) {
    throw new ApiError("本等级名额已抽完", ErrorCode.VALIDATION_ERROR, 400);
  }

  const winnerUserIds = new Set(existingWinners.map((w) => w.userId));
  const pool = entries.filter((e) => !winnerUserIds.has(e.userId));

  if (pool.length < drawCount) {
    throw new ApiError(
      `奖池剩余参与者不足，需要 ${drawCount} 人，当前可选 ${pool.length} 人`,
      ErrorCode.VALIDATION_ERROR,
      400,
    );
  }

  const shuffled = fisherYatesShuffle(pool);
  const picked = shuffled.slice(0, drawCount);
  const prizeRank = resolvePrizeTier(targetPrize);

  const created = await prisma.$transaction(
    async (tx) => {
      if (drawCount === 1) {
        const entry = picked[0]!;
        const winnerRow = await tx.lotteryWinner.create({
          data: {
            lotteryId,
            userId: entry.userId,
            entryId: entry.id,
            prizeId: targetPrize.id,
            prizeRank,
            prizeName: targetPrize.name,
          },
        });
        const redemption = await attachToRedemptionCode(
          entry.userId,
          eventId,
          winnerRow.id,
          tx,
        );
        return [
          {
            winnerRow,
            picked: entry,
            code: redemption.code,
          },
        ];
      }

      const codeByUser = await ensureEventCodesForUsers(
        eventId,
        picked.map((entry) => entry.userId),
        tx,
      );

      const winnerRows = await tx.lotteryWinner.createManyAndReturn({
        data: picked.map((entry) => ({
          lotteryId,
          userId: entry.userId,
          entryId: entry.id,
          prizeId: targetPrize.id,
          prizeRank,
          prizeName: targetPrize.name,
          eventCodeId: codeByUser.get(entry.userId)!.id,
        })),
      });

      const winnerByUserId = new Map(winnerRows.map((row) => [row.userId, row]));

      return picked.map((entry) => ({
        winnerRow: winnerByUserId.get(entry.userId)!,
        picked: entry,
        code: codeByUser.get(entry.userId)!.code,
      }));
    },
    { timeout: 60_000 },
  );

  const winners: LotteryScreenWinnerPayload[] = created.map(
    ({ winnerRow, picked: entry, code }) => ({
      id: winnerRow.id,
      user_id: entry.userId,
      name: entry.user.name,
      company: entry.user.profile?.company ?? null,
      prize_name: targetPrize.name,
      prize_rank: prizeRank,
      verification_code: code,
      pickup_note: "请凭统一核销码至领奖台领取奖品",
    }),
  );

  const thisDrawWinners: TierDrawWinnerResult[] = created.map(
    ({ winnerRow, picked: entry, code }) => ({
      winnerId: winnerRow.id,
      userId: entry.userId,
      name: entry.user.name,
      avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${resolveAvatarSeed(entry.user.name)}`,
      company: entry.user.profile?.company ?? null,
      verification_code: code,
    }),
  );

  return { winners, thisDrawWinners };
}

async function drawOneWinnerForPrize(
  eventId: string,
  lotteryId: string,
  targetPrize: PrizeItem,
  entries: Array<{
    id: string;
    userId: string;
    user: { name: string; profile: { company: string | null } | null };
  }>,
  existingWinners: Array<{ userId: string }>,
) {
  const { winners, thisDrawWinners } = await drawWinnersForPrize(
    eventId,
    lotteryId,
    targetPrize,
    1,
    entries,
    existingWinners,
  );
  const winner = winners[0]!;
  const picked = entries.find((e) => e.userId === winner.user_id)!;
  return { winner, winnerRow: { id: thisDrawWinners[0]!.winnerId }, picked };
}

export async function startLotteryScreen(eventId: string, lotteryId: string) {
  const lottery = await getOrganizerLotteryOrThrow(eventId, lotteryId);
  const meta = await loadOrganizerLotteryMeta(
    eventId,
    lotteryId,
    lottery.bigScreenAnimationType,
  );

  if (
    lottery.status !== LotteryStatus.OPEN &&
    lottery.status !== LotteryStatus.DRAWING
  ) {
    throw new ApiError("抽奖未开放，无法启动大屏", ErrorCode.VALIDATION_ERROR, 400);
  }

  await syncOrganizerLotteryEntriesFromEligibility(eventId, lotteryId);

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
    throw new ApiError(
      "暂无符合门槛的参与者，请确认参会者已签到且手机号/邮箱与小程序账号一致",
      ErrorCode.VALIDATION_ERROR,
      400,
    );
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
      ? lottery.prizeItems.map((p) => ({
          rank: resolvePrizeTier(p),
          name: p.name,
          quantity: p.quantity,
        }))
      : [];

  const data: LotteryScreenStartData = {
    lottery_id: lotteryId,
    title: lottery.title,
    animation: bigScreenToLegacyAnimation(meta.big_screen_animation_type),
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
  await syncOrganizerLotteryEntriesFromEligibility(eventId, lotteryId);

  const lottery = await getOrganizerLotteryOrThrow(eventId, lotteryId);
  const meta = await loadOrganizerLotteryMeta(
    eventId,
    lotteryId,
    lottery.bigScreenAnimationType,
  );

  if (meta.prize_draw_order === "ASC") {
    throw new ApiError(
      "当前为分级开奖模式，请使用「开始 X 等奖抽奖」与分级揭晓",
      ErrorCode.VALIDATION_ERROR,
      400,
    );
  }

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

  let targetPrize: PrizeItem | null = null;
  for (const prize of sortPrizesForDraw(prizeItems, meta.prize_draw_order)) {
    const drawnForPrize = existingWinners.filter(
      (w) => w.prizeId === prize.id || w.prizeRank === resolvePrizeTier(prize),
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

  const { winner } = await drawOneWinnerForPrize(
    eventId,
    lotteryId,
    targetPrize,
    entries,
    existingWinners,
  );

  const winnerQuota = prizeItems.reduce((sum, p) => sum + p.quantity, 0);
  const revealedTotal = existingWinners.length + 1;

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

export async function startLotteryTierDraw(
  eventId: string,
  lotteryId: string,
  tier: number,
) {
  await syncOrganizerLotteryEntriesFromEligibility(eventId, lotteryId);

  const lottery = await getOrganizerLotteryOrThrow(eventId, lotteryId);
  const meta = await loadOrganizerLotteryMeta(
    eventId,
    lotteryId,
    lottery.bigScreenAnimationType,
  );

  if (meta.prize_draw_order !== "ASC") {
    throw new ApiError("当前为一次性开奖模式", ErrorCode.VALIDATION_ERROR, 400);
  }

  if (
    lottery.status !== LotteryStatus.OPEN &&
    lottery.status !== LotteryStatus.DRAWING
  ) {
    throw new ApiError("抽奖未开放，无法开始等级开奖", ErrorCode.VALIDATION_ERROR, 400);
  }

  const prize = lottery.prizeItems.find((p) => resolvePrizeTier(p) === tier);
  if (!prize) {
    throw new ApiError("奖品等级不存在", ErrorCode.NOT_FOUND, 404);
  }

  const existingWinners = await prisma.lotteryWinner.findMany({
    where: { lotteryId },
    select: { prizeId: true, prizeRank: true },
  });

  const tiers = buildTierStates(
    lottery.prizeItems,
    existingWinners,
    meta.prize_draw_order,
    meta.active_draw_tier,
  );

  const targetTier = tiers.find((t) => t.tier === tier);
  if (!targetTier) {
    throw new ApiError("奖品等级不存在", ErrorCode.NOT_FOUND, 404);
  }
  if (targetTier.complete) {
    throw new ApiError(`${targetTier.label} 已全部揭晓`, ErrorCode.VALIDATION_ERROR, 400);
  }

  const nextTier = tiers.find((t) => t.is_next);
  if (nextTier && nextTier.tier !== tier) {
    throw new ApiError(
      `请先完成 ${nextTier.label} 开奖`,
      ErrorCode.VALIDATION_ERROR,
      400,
    );
  }

  if (meta.active_draw_tier != null && meta.active_draw_tier !== tier) {
    throw new ApiError(
      `请先完成 ${tierLabel(meta.active_draw_tier)} 开奖`,
      ErrorCode.VALIDATION_ERROR,
      400,
    );
  }

  if (lottery.status === LotteryStatus.OPEN) {
    await prisma.lottery.update({
      where: { id: lotteryId },
      data: { status: LotteryStatus.DRAWING },
    });
  }

  await patchOrganizerLotteryDrawMeta(eventId, lotteryId, {
    active_draw_tier: tier,
  });

  const sent = await broadcastLotteryScreenMessage(eventId, {
    type: "TIER_START",
    data: {
      lottery_id: lotteryId,
      tier,
      tier_label: tierLabel(tier),
      prize_name: prize.name,
      quantity: prize.quantity,
      drawn_count: targetTier.drawn_count,
    },
  });

  return {
    sent,
    tier,
    tier_label: tierLabel(tier),
    prize_name: prize.name,
    quantity: prize.quantity,
    drawn_count: targetTier.drawn_count,
  };
}

export async function drawLotteryTierWinners(
  eventId: string,
  lotteryId: string,
  tier: number,
  mode: TierDrawMode,
): Promise<DrawTierWinnersResult> {
  await syncOrganizerLotteryEntriesFromEligibility(eventId, lotteryId);

  const lottery = await getOrganizerLotteryOrThrow(eventId, lotteryId);
  const meta = await loadOrganizerLotteryMeta(
    eventId,
    lotteryId,
    lottery.bigScreenAnimationType,
  );

  if (meta.prize_draw_order !== "ASC") {
    throw new ApiError("当前为一次性开奖模式", ErrorCode.VALIDATION_ERROR, 400);
  }

  if (meta.active_draw_tier !== tier) {
    throw new ApiError(
      `请先点击「开始${tierLabel(tier)}抽奖」`,
      ErrorCode.VALIDATION_ERROR,
      400,
    );
  }

  const prize = lottery.prizeItems.find((p) => resolvePrizeTier(p) === tier);
  if (!prize) {
    throw new ApiError("奖品等级不存在", ErrorCode.NOT_FOUND, 404);
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

  const drawnForTier = existingWinners.filter(
    (w) => w.prizeId === prize.id || w.prizeRank === tier,
  ).length;
  const remaining = prize.quantity - drawnForTier;

  if (remaining <= 0) {
    await patchOrganizerLotteryDrawMeta(eventId, lotteryId, {
      active_draw_tier: null,
    });
    throw new ApiError(`${tierLabel(tier)} 名额已抽完`, ErrorCode.VALIDATION_ERROR, 400);
  }

  const drawCount = mode === "ONE" ? 1 : remaining;

  const { winners, thisDrawWinners } = await drawWinnersForPrize(
    eventId,
    lotteryId,
    prize,
    drawCount,
    entries,
    existingWinners,
  );

  const winnerQuota = lottery.prizeItems.reduce((sum, p) => sum + p.quantity, 0);
  const revealedTotal = existingWinners.length + winners.length;
  const totalDrawnCount = drawnForTier + winners.length;
  const remainingCount = prize.quantity - totalDrawnCount;
  const tierComplete = remainingCount <= 0;

  if (tierComplete) {
    await patchOrganizerLotteryDrawMeta(eventId, lotteryId, {
      active_draw_tier: null,
    });
  }

  if (revealedTotal >= winnerQuota) {
    await prisma.lottery.update({
      where: { id: lotteryId },
      data: { status: LotteryStatus.FINISHED, drawnAt: new Date() },
    });
    await patchOrganizerLotteryDrawMeta(eventId, lotteryId, {
      active_draw_tier: null,
    });
  }

  let sent = false;
  try {
    sent = await broadcastLotteryScreenMessage(eventId, {
      type: "REVEAL_TIER",
      data: {
        lottery_id: lotteryId,
        tier,
        tier_label: tierLabel(tier),
        prize_name: prize.name,
        winners,
        revealed_total: revealedTotal,
        winner_quota: winnerQuota,
        total_drawn_count: totalDrawnCount,
        remaining_count: remainingCount,
      },
    });
  } catch (err) {
    console.error("[lottery-screen] REVEAL_TIER broadcast failed", err);
  }

  return {
    sent,
    tier,
    tier_label: tierLabel(tier),
    prizeName: prize.name,
    quantity: prize.quantity,
    thisDrawWinners,
    totalDrawnCount,
    remainingCount,
    tier_complete: tierComplete,
    revealed_total: revealedTotal,
    winner_quota: winnerQuota,
    finished: revealedTotal >= winnerQuota,
  };
}

/** @deprecated 使用 drawLotteryTierWinners(mode: ONE) */
export async function revealLotteryTierWinner(
  eventId: string,
  lotteryId: string,
  tier: number,
) {
  const result = await drawLotteryTierWinners(eventId, lotteryId, tier, "ONE");
  const winner = result.thisDrawWinners[0];
  if (!winner) {
    throw new ApiError("抽取失败", ErrorCode.INTERNAL_ERROR, 500);
  }
  return {
    sent: result.sent,
    winner: {
      id: winner.winnerId,
      user_id: winner.userId,
      name: winner.name,
      company: winner.company,
      prize_name: result.prizeName,
      prize_rank: result.tier,
      verification_code: winner.verification_code,
      pickup_note: "请凭统一核销码至领奖台领取奖品",
    },
    tier: result.tier,
    tier_label: result.tier_label,
    tier_complete: result.tier_complete,
    revealed_total: result.revealed_total,
    winner_quota: result.winner_quota,
    finished: result.finished,
  };
}

export async function endLotteryScreen(eventId: string, lotteryId: string) {
  await getOrganizerLotteryOrThrow(eventId, lotteryId);

  await patchOrganizerLotteryDrawMeta(eventId, lotteryId, {
    active_draw_tier: null,
  });

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
  await syncOrganizerLotteryEntriesFromEligibility(eventId, lotteryId);

  const lottery = await getOrganizerLotteryOrThrow(eventId, lotteryId);
  const meta = await loadOrganizerLotteryMeta(
    eventId,
    lotteryId,
    lottery.bigScreenAnimationType,
  );

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
  const entryCount = await prisma.lotteryEntry.count({ where: { lotteryId } });

  const entries = await prisma.lotteryEntry.findMany({
    where: { lotteryId },
    take: 200,
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

  const tierStates = buildTierStates(
    lottery.prizeItems,
    winners.map((w) => ({ prizeId: w.prizeId, prizeRank: w.prizeRank })),
    meta.prize_draw_order,
    meta.active_draw_tier,
  );

  const scan_join = meta.eligibility.allow_scan_join
    ? (await resolveOrganizerLotteryScanJoin(eventId, lotteryId)) ??
      (await ensureOrganizerLotteryScanSession({
        eventId,
        lotteryId,
        title: lottery.title,
        createdById: lottery.createdById,
      }).catch(() => null))
    : null;

  return {
    lottery: {
      id: lottery.id,
      title: lottery.title,
      status: lottery.status,
      draw_at: lottery.drawAt?.toISOString() ?? null,
      entry_count: entryCount,
      animation: bigScreenToLegacyAnimation(meta.big_screen_animation_type),
      big_screen_animation_type: meta.big_screen_animation_type,
      prize_draw_order: meta.prize_draw_order,
      allow_scan_join: meta.eligibility.allow_scan_join,
    },
    scan_join,
    winner_quota: winnerQuota,
    revealed_count: winners.length,
    active_tier: meta.active_draw_tier,
    tiers: tierStates,
    /** 大屏断线/错过广播时用 HTTP 兜底还原滚动名单 */
    rolling_entries: entries.map((e) => ({
      id: e.userId,
      name: e.user.name,
      company: e.user.profile?.company ?? null,
    })),
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
