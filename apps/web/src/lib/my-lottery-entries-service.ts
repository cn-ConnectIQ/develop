import { LotteryDrawType, LotteryStatus, prisma } from "@connectiq/database";

export type MyLotteryEntryStatus = "ongoing" | "won" | "lost";

export type MyLotteryEntryRow = {
  entry_id: string;
  lottery_id: string;
  event_id: string;
  event_name: string;
  booth_id: string | null;
  exhibitor_name: string | null;
  exhibitor_logo_url: string | null;
  booth_name: string | null;
  prize_name: string;
  prize_image_url: string | null;
  entered_at: string;
  status: MyLotteryEntryStatus;
  countdown_seconds: number | null;
  draw_at: string | null;
  verification_code: string | null;
  verified: boolean;
  pickup_note: string | null;
};

function isLotteryDrawn(status: LotteryStatus, drawnAt: Date | null): boolean {
  return (
    status === LotteryStatus.FINISHED ||
    status === LotteryStatus.ENDED ||
    drawnAt != null
  );
}

function computeEntryStatus(
  drawType: LotteryDrawType,
  lotteryStatus: LotteryStatus,
  drawnAt: Date | null,
  hasWinner: boolean,
): MyLotteryEntryStatus {
  if (hasWinner) return "won";
  if (drawType === LotteryDrawType.INSTANT) return "lost";
  if (isLotteryDrawn(lotteryStatus, drawnAt)) return "lost";
  return "ongoing";
}

function resolvePrizeName(
  winnerPrizeName: string | null | undefined,
  lotteryTitle: string,
  prizeItems: Array<{ name: string }>,
): string {
  if (winnerPrizeName?.trim()) return winnerPrizeName.trim();
  if (prizeItems[0]?.name) return prizeItems[0].name;
  return lotteryTitle;
}

export async function listMyLotteryEntries(userId: string): Promise<MyLotteryEntryRow[]> {
  const entries = await prisma.lotteryEntry.findMany({
    where: { userId },
    orderBy: { enteredAt: "desc" },
    include: {
      winner: true,
      lottery: {
        include: {
          event: { select: { id: true, name: true } },
          booth: {
            select: {
              id: true,
              name: true,
              code: true,
              companyOrg: { select: { name: true, logoUrl: true } },
            },
          },
          prizeItems: { orderBy: { sortOrder: "asc" }, take: 1 },
        },
      },
    },
  });

  const now = Date.now();

  return entries.map((entry) => {
    const lottery = entry.lottery;
    const winner = entry.winner;
    const booth = lottery.booth;
    const status = computeEntryStatus(
      lottery.drawType,
      lottery.status,
      lottery.drawnAt,
      Boolean(winner),
    );

    let countdownSeconds: number | null = null;
    const drawAt = lottery.drawAt ?? lottery.drawnAt;
    if (status === "ongoing" && drawAt) {
      countdownSeconds = Math.max(0, Math.floor((drawAt.getTime() - now) / 1000));
    }

    const prizeName = resolvePrizeName(
      winner?.prizeName,
      lottery.title,
      lottery.prizeItems,
    );

    const pickupNote = winner
      ? booth
        ? `请至 ${booth.name}（${booth.code}）服务台凭核销码领取`
        : "请凭核销码至活动服务台领取"
      : null;

    return {
      entry_id: entry.id,
      lottery_id: lottery.id,
      event_id: lottery.eventId,
      event_name: lottery.event.name,
      booth_id: booth?.id ?? lottery.boothId,
      exhibitor_name: booth?.companyOrg.name ?? null,
      exhibitor_logo_url: booth?.companyOrg.logoUrl ?? null,
      booth_name: booth?.name ?? null,
      prize_name: prizeName,
      prize_image_url: lottery.coverImage ?? lottery.prizeItems[0]?.imageUrl ?? null,
      entered_at: entry.enteredAt.toISOString(),
      status,
      countdown_seconds: countdownSeconds,
      draw_at: drawAt?.toISOString() ?? null,
      verification_code: winner?.verificationCode ?? null,
      verified: winner?.verified ?? false,
      pickup_note: pickupNote,
    };
  });
}
