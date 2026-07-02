import {
  LotteryDrawType,
  LotteryStatus,
  prisma,
} from "@connectiq/database";
import { ErrorCode } from "@connectiq/types";
import { ApiError, requireBoothAccess } from "@/lib/api-auth";
import {
  computeLeadAiIntentLevel,
  type AiIntentLevel,
} from "@/lib/exhibitor/lead-intent-service";
import { fisherYatesShuffle } from "@/lib/interaction/lottery-rewards";
import {
  broadcastLotteryResult,
  type LotteryWinnerPayload,
} from "@/lib/realtime";
import { isLotteryOpenForEntry } from "@/lib/lottery/booth-lottery-service";
import type { LotteryPrizeConfig } from "@/lib/interaction/schemas";

export type LotteryDashboardEntry = {
  id: string;
  user_id: string;
  name: string;
  company: string | null;
  job_title: string | null;
  avatar_url: string | null;
  ai_intent_level: AiIntentLevel;
  entered_at: string;
  won: boolean;
};

export type LotteryDashboardWinner = {
  id: string;
  user_id: string;
  name: string;
  company: string | null;
  avatar_url: string | null;
  prize_name: string;
  prize_rank: number;
  verification_code: string | null;
  drawn_at: string;
};

export type LotteryDashboardData = {
  lottery: {
    id: string;
    event_id: string;
    booth_id: string | null;
    title: string;
    status: LotteryStatus;
    draw_type: LotteryDrawType;
    draw_at: string | null;
    require_lead_capture: boolean;
  };
  stats: {
    participant_count: number;
    lead_count: number;
    intent_distribution: { A: number; B: number; C: number };
    winner_quota: number;
    winner_drawn: number;
  };
  recent_entries: LotteryDashboardEntry[];
  winners: LotteryDashboardWinner[];
};

function generateVerificationCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function resolveAvatarSeed(name: string): string {
  return encodeURIComponent(name.slice(0, 1) || "?");
}

export async function requireLotteryBoothAccess(lotteryId: string) {
  const lottery = await prisma.lottery.findUnique({
    where: { id: lotteryId },
    include: {
      booth: {
        select: {
          id: true,
          eventId: true,
          code: true,
          name: true,
          companyOrgId: true,
        },
      },
      prizeItems: { orderBy: { sortOrder: "asc" } },
    },
  });

  if (!lottery) {
    throw new ApiError("抽奖不存在", ErrorCode.NOT_FOUND, 404);
  }
  if (!lottery.boothId) {
    throw new ApiError("非展位抽奖", ErrorCode.FORBIDDEN, 403);
  }

  const access = await requireBoothAccess(lottery.boothId);
  return { lottery, ...access };
}

function resolvePrizePlan(lottery: {
  prizeItems: Array<{
    id: string;
    name: string;
    quantity: number;
    sortOrder: number;
  }>;
  prizes: unknown;
}) {
  if (lottery.prizeItems.length > 0) {
    return lottery.prizeItems.map((item, index) => ({
      id: item.id,
      rank: index + 1,
      name: item.name,
      quantity: item.quantity,
    }));
  }

  const legacy = Array.isArray(lottery.prizes)
    ? (lottery.prizes as LotteryPrizeConfig[])
    : [];

  return legacy.map((p, index) => ({
    id: null as string | null,
    rank: p.rank ?? index + 1,
    name: p.prize ?? p.name ?? `第 ${index + 1} 等奖`,
    quantity: p.count ?? 1,
  }));
}

export async function getLotteryDashboard(
  lotteryId: string,
): Promise<LotteryDashboardData> {
  const { lottery } = await requireLotteryBoothAccess(lotteryId);
  const boothId = lottery.boothId!;
  const eventId = lottery.eventId;

  const [entryRows, winners, leadCount, participantCount] = await Promise.all([
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
        lead: {
          select: {
            id: true,
            intentGrade: true,
            participant: {
              select: {
                name: true,
                company: true,
                jobTitle: true,
                email: true,
                phone: true,
              },
            },
          },
        },
      },
      orderBy: { enteredAt: "desc" },
      take: 50,
    }),
    prisma.lotteryWinner.findMany({
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
    }),
    prisma.lotteryEntry.count({
      where: { lotteryId, leadId: { not: null } },
    }),
    prisma.lotteryEntry.count({ where: { lotteryId } }),
  ]);

  const winnerUserIds = new Set(winners.map((w) => w.userId));
  const prizePlan = resolvePrizePlan(lottery);
  const winnerQuota = prizePlan.reduce((sum, p) => sum + p.quantity, 0);

  const recent_entries: LotteryDashboardEntry[] = [];

  for (const entry of entryRows) {
    const participant = entry.lead?.participant;
    let aiLevel: AiIntentLevel = "C";

    if (participant) {
      aiLevel = await computeLeadAiIntentLevel(
        boothId,
        eventId,
        participant,
        entry.lead?.intentGrade ?? null,
      );
    } else if (
      entry.lead?.intentGrade === "A" ||
      entry.lead?.intentGrade === "B" ||
      entry.lead?.intentGrade === "C"
    ) {
      aiLevel = entry.lead.intentGrade;
    }

    recent_entries.push({
      id: entry.id,
      user_id: entry.userId,
      name: entry.user.name,
      company: participant?.company ?? entry.user.profile?.company ?? null,
      job_title: participant?.jobTitle ?? null,
      avatar_url: `https://api.dicebear.com/7.x/initials/svg?seed=${resolveAvatarSeed(entry.user.name)}`,
      ai_intent_level: aiLevel,
      entered_at: entry.enteredAt.toISOString(),
      won: winnerUserIds.has(entry.userId),
    });
  }

  const intent_distribution = { A: 0, B: 0, C: 0 };
  const allEntriesForIntent = await prisma.lotteryEntry.findMany({
    where: { lotteryId },
    select: {
      lead: {
        select: {
          intentGrade: true,
          participant: {
            select: { email: true, phone: true, name: true, company: true, jobTitle: true },
          },
        },
      },
    },
  });

  for (const entry of allEntriesForIntent) {
    let level: AiIntentLevel = "C";
    if (
      entry.lead?.intentGrade === "A" ||
      entry.lead?.intentGrade === "B" ||
      entry.lead?.intentGrade === "C"
    ) {
      level = entry.lead.intentGrade;
    } else if (entry.lead?.participant) {
      level = await computeLeadAiIntentLevel(
        boothId,
        eventId,
        entry.lead.participant,
        null,
      );
    } else if (entry.lead) {
      level = "B";
    }
    intent_distribution[level] += 1;
  }

  return {
    lottery: {
      id: lottery.id,
      event_id: eventId,
      booth_id: boothId,
      title: lottery.title,
      status: lottery.status,
      draw_type: lottery.drawType,
      draw_at: lottery.drawAt?.toISOString() ?? null,
      require_lead_capture: lottery.requireLeadCapture,
    },
    stats: {
      participant_count: participantCount,
      lead_count: leadCount,
      intent_distribution,
      winner_quota: winnerQuota,
      winner_drawn: winners.length,
    },
    recent_entries,
    winners: winners.map((w) => ({
      id: w.id,
      user_id: w.userId,
      name: w.user.name,
      company: w.user.profile?.company ?? null,
      avatar_url: `https://api.dicebear.com/7.x/initials/svg?seed=${resolveAvatarSeed(w.user.name)}`,
      prize_name: w.prizeName,
      prize_rank: w.prizeRank,
      verification_code: w.verificationCode,
      drawn_at: w.drawnAt.toISOString(),
    })),
  };
}

export async function executeLotteryDraw(lotteryId: string) {
  const { lottery } = await requireLotteryBoothAccess(lotteryId);

  if (
    lottery.status === LotteryStatus.FINISHED ||
    lottery.status === LotteryStatus.ENDED
  ) {
    throw new ApiError("抽奖已结束", ErrorCode.VALIDATION_ERROR, 400);
  }

  if (
    !isLotteryOpenForEntry(lottery.status) &&
    lottery.status !== LotteryStatus.DRAWING
  ) {
    throw new ApiError("当前状态无法开奖", ErrorCode.VALIDATION_ERROR, 400);
  }

  const prizePlan = resolvePrizePlan(lottery);
  if (prizePlan.length === 0) {
    throw new ApiError("未配置奖品", ErrorCode.VALIDATION_ERROR, 400);
  }

  const totalWinnersNeeded = prizePlan.reduce((sum, p) => sum + p.quantity, 0);

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

  if (entries.length === 0) {
    throw new ApiError("暂无参与者，无法开奖", ErrorCode.VALIDATION_ERROR, 400);
  }

  const winnerUserIds = new Set(existingWinners.map((w) => w.userId));
  let pool = lottery.allowReenter
    ? [...entries]
    : entries.filter((e) => !winnerUserIds.has(e.userId));

  const createdWinners: LotteryWinnerPayload[] = [];

  await prisma.$transaction(async (tx) => {
    if (isLotteryOpenForEntry(lottery.status)) {
      await tx.lottery.update({
        where: { id: lotteryId },
        data: { status: LotteryStatus.DRAWING },
      });
    }

    for (const prize of prizePlan) {
      if (pool.length === 0) break;

      const shuffled = fisherYatesShuffle(pool);
      const picked = shuffled.slice(0, Math.min(prize.quantity, shuffled.length));
      pool = pool.filter(
        (entry) => !picked.some((p) => p.userId === entry.userId),
      );

      for (const entry of picked) {
        let verificationCode = generateVerificationCode();
        for (let attempt = 0; attempt < 5; attempt++) {
          const exists = await tx.lotteryWinner.findUnique({
            where: { verificationCode },
            select: { id: true },
          });
          if (!exists) break;
          verificationCode = generateVerificationCode();
        }

        const winner = await tx.lotteryWinner.create({
          data: {
            lotteryId,
            userId: entry.userId,
            entryId: entry.id,
            prizeId: prize.id,
            prizeRank: prize.rank,
            prizeName: prize.name,
            verificationCode,
          },
        });

        createdWinners.push({
          id: winner.id,
          userId: entry.userId,
          prizeRank: prize.rank,
          prizeName: prize.name,
          name: entry.user.name,
          company: entry.user.profile?.company ?? null,
          avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=${resolveAvatarSeed(entry.user.name)}`,
          drawnAt: winner.drawnAt.toISOString(),
        });
      }
    }

    await tx.lottery.update({
      where: { id: lotteryId },
      data: {
        status: LotteryStatus.FINISHED,
        drawnAt: new Date(),
      },
    });
  });

  if (createdWinners.length > 0) {
    await broadcastLotteryResult(lottery.eventId, lotteryId, createdWinners);
  }

  return {
    participant_count: entries.length,
    winner_count: createdWinners.length,
    winner_quota: totalWinnersNeeded,
    winners: createdWinners.map((w) => ({
      id: w.id,
      user_id: w.userId,
      name: w.name,
      company: w.company,
      avatar_url: w.avatarUrl,
      prize_name: w.prizeName,
      prize_rank: w.prizeRank,
      drawn_at: w.drawnAt,
    })),
  };
}

export async function listLotteryDashboardWinners(lotteryId: string) {
  const dashboard = await getLotteryDashboard(lotteryId);
  return dashboard.winners;
}

export async function broadcastLotteryWinners(lotteryId: string) {
  const { lottery } = await requireLotteryBoothAccess(lotteryId);

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

  if (winners.length === 0) {
    throw new ApiError("暂无中奖名单", ErrorCode.VALIDATION_ERROR, 400);
  }

  const payload: LotteryWinnerPayload[] = winners.map((w) => ({
    id: w.id,
    userId: w.userId,
    prizeRank: w.prizeRank,
    prizeName: w.prizeName,
    name: w.user.name,
    company: w.user.profile?.company ?? null,
    avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=${resolveAvatarSeed(w.user.name)}`,
    drawnAt: w.drawnAt.toISOString(),
  }));

  const sent = await broadcastLotteryResult(
    lottery.eventId,
    lotteryId,
    payload,
  );

  return { sent, count: payload.length };
}

export async function buildLotteryLeadsExport(lotteryId: string) {
  const { lottery } = await requireLotteryBoothAccess(lotteryId);
  const boothId = lottery.boothId!;
  const eventId = lottery.eventId;

  const entries = await prisma.lotteryEntry.findMany({
    where: { lotteryId },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          profile: { select: { company: true } },
        },
      },
      lead: {
        select: {
          id: true,
          intentGrade: true,
          notes: true,
          crmSyncStatus: true,
          participant: {
            select: {
              name: true,
              company: true,
              jobTitle: true,
              email: true,
              phone: true,
            },
          },
        },
      },
    },
    orderBy: { enteredAt: "asc" },
  });

  const winners = await prisma.lotteryWinner.findMany({
    where: { lotteryId },
    select: { userId: true, prizeName: true, verificationCode: true },
  });
  const winnerMap = new Map(winners.map((w) => [w.userId, w]));

  const rows: string[][] = [
    [
      "姓名",
      "公司",
      "职位",
      "手机",
      "邮箱",
      "AI评级",
      "是否中奖",
      "奖品",
      "核销码",
      "留资数据",
      "CRM同步状态",
      "参与时间",
    ],
  ];

  for (const entry of entries) {
    const participant = entry.lead?.participant;
    const aiLevel = participant
      ? await computeLeadAiIntentLevel(
          boothId,
          eventId,
          participant,
          entry.lead?.intentGrade ?? null,
        )
      : ((entry.lead?.intentGrade as AiIntentLevel | null) ?? "C");

    const winner = winnerMap.get(entry.userId);
    const leadData =
      entry.leadData && typeof entry.leadData === "object"
        ? JSON.stringify(entry.leadData)
        : (entry.lead?.notes ?? "");

    rows.push([
      participant?.name ?? entry.user.name,
      participant?.company ?? entry.user.profile?.company ?? "",
      participant?.jobTitle ?? "",
      participant?.phone ?? entry.user.phone ?? "",
      participant?.email ?? entry.user.email ?? "",
      aiLevel,
      winner ? "是" : "否",
      winner?.prizeName ?? "",
      winner?.verificationCode ?? "",
      leadData,
      entry.lead?.crmSyncStatus ?? "",
      entry.enteredAt.toISOString(),
    ]);
  }

  const csv = rows
    .map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","),
    )
    .join("\n");

  return {
    csv: `\uFEFF${csv}`,
    filename: `lottery-${lotteryId.slice(-8)}-leads.csv`,
  };
}

export async function syncLotteryLeadsToMarketup(lotteryId: string) {
  const { lottery } = await requireLotteryBoothAccess(lotteryId);
  const eventId = lottery.eventId;

  const entries = await prisma.lotteryEntry.findMany({
    where: { lotteryId, leadId: { not: null } },
    select: { leadId: true },
  });

  const leadIds = [
    ...new Set(entries.map((e) => e.leadId).filter(Boolean)),
  ] as string[];

  const { scheduleLeadMarketupSync } = await import("@/lib/marketup-sync");
  await Promise.all(
    leadIds.map((leadId) => scheduleLeadMarketupSync(leadId, eventId)),
  );

  return {
    queued: leadIds.length,
    lead_ids: leadIds,
  };
}
