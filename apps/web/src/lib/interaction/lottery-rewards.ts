import { FeedItemType, PointsReason, prisma } from "@connectiq/database";
import type { Lottery } from "@connectiq/database";

const LOTTERY_WIN_POINTS = 500;

export function fisherYatesShuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}

export async function grantLotteryWinPoints(
  userIds: string[],
  lotteryTitle: string,
) {
  if (userIds.length === 0) return;

  const note = `抽奖中奖奖励：${lotteryTitle}`;

  await prisma.$transaction(
    userIds.flatMap((userId) => [
      prisma.pointsLedger.create({
        data: {
          userId,
          amount: LOTTERY_WIN_POINTS,
          reason: PointsReason.INTERACTION,
          note,
        },
      }),
      prisma.userProfile.upsert({
        where: { userId },
        create: { userId, pointsBalance: LOTTERY_WIN_POINTS },
        update: { pointsBalance: { increment: LOTTERY_WIN_POINTS } },
      }),
    ]),
  );
}

export async function sendLotteryWinNotification(
  winners: Array<{ id: string; userId: string; prizeName: string }>,
  lottery: Pick<Lottery, "id" | "title">,
) {
  if (winners.length === 0) return;

  await prisma.$transaction([
    prisma.feedItem.createMany({
      data: winners.map((w) => ({
        userId: w.userId,
        type: FeedItemType.SYSTEM,
        content: `恭喜您在「${lottery.title}」中获得 ${w.prizeName}！`,
      })),
    }),
    prisma.lotteryWinner.updateMany({
      where: { id: { in: winners.map((w) => w.id) } },
      data: { notified: true },
    }),
  ]);

  const { sendLotteryResultSubscribe } = await import("@/lib/wechat/subscribe-message");
  for (const winner of winners) {
    void sendLotteryResultSubscribe({
      toUserId: winner.userId,
      lotteryTitle: lottery.title,
      prizeName: winner.prizeName,
      lotteryId: lottery.id,
    });
  }
}
