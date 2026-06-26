/**
 * 互动模拟提交 — Poll 回复 / Lottery 参与 / 中奖记录
 */
import { LotteryEntrySource } from "@prisma/client";
import { prisma } from "../src/client";

export const SAMPLE_WORD_CLOUD = [
  "专业",
  "高效",
  "创新",
  "连接",
  "干货",
  "惊喜",
  "值得",
  "智能",
  "期待",
  "流畅",
];

export const SAMPLE_QNA = [
  "现场资料在哪里领取？",
  "演讲 PPT 会分享吗？",
  "如何预约一对一洽谈？",
  "下一轮抽奖什么时候开始？",
  "WiFi 密码是多少？",
  "是否有活动回放？",
  "如何联系客服？",
  "展商名录在哪里下载？",
];

export async function seedLotteryEntries(
  lotteryId: string,
  userIds: string[],
  idPrefix: string,
  max?: number,
) {
  const slice = userIds.slice(0, max ?? userIds.length);
  for (const [i, userId] of slice.entries()) {
    const entryId = `${idPrefix}-${i}`;
    await prisma.lotteryEntry.upsert({
      where: { id: entryId },
      update: { userId, lotteryId },
      create: {
        id: entryId,
        lotteryId,
        userId,
        source: LotteryEntrySource.MANUAL,
      },
    });
  }
  if (slice.length > 0) {
    await prisma.lottery.update({
      where: { id: lotteryId },
      data: { entryCount: slice.length },
    });
  }
}

export async function seedLotteryWinner(
  id: string,
  lotteryId: string,
  userId: string,
  prizeRank: number,
  prizeName: string,
) {
  await prisma.lotteryWinner.upsert({
    where: { id },
    update: { prizeRank, prizeName, notified: true },
    create: {
      id,
      lotteryId,
      userId,
      prizeRank,
      prizeName,
      notified: true,
    },
  });
}

export async function seedMultiChoiceResponses(
  pollId: string,
  optionIds: string[],
  participantIds: string[],
  idPrefix: string,
) {
  for (let i = 0; i < participantIds.length; i++) {
    const pid = participantIds[i]!;
    const picks = Math.min(optionIds.length, 1 + (i % 2));
    for (let j = 0; j < picks; j++) {
      await prisma.pollResponse.upsert({
        where: { id: `${idPrefix}-m-${i}-${j}` },
        update: {},
        create: {
          id: `${idPrefix}-m-${i}-${j}`,
          pollId,
          participantId: pid,
          optionId: optionIds[(i + j) % optionIds.length]!,
        },
      });
    }
  }
}

export async function seedWordCloudResponses(
  pollId: string,
  participantIds: string[],
  idPrefix: string,
  words: string[] = SAMPLE_WORD_CLOUD,
) {
  for (let i = 0; i < participantIds.length; i++) {
    await prisma.pollResponse.upsert({
      where: { id: `${idPrefix}-wc-${i}` },
      update: {},
      create: {
        id: `${idPrefix}-wc-${i}`,
        pollId,
        participantId: participantIds[i]!,
        textAnswer: words[i % words.length]!,
      },
    });
  }
}

export async function seedRatingResponses(
  pollId: string,
  participantIds: string[],
  idPrefix: string,
) {
  for (let i = 0; i < participantIds.length; i++) {
    await prisma.pollResponse.upsert({
      where: { id: `${idPrefix}-rt-${i}` },
      update: {},
      create: {
        id: `${idPrefix}-rt-${i}`,
        pollId,
        participantId: participantIds[i]!,
        rating: (i % 5) + 1,
      },
    });
  }
}

export async function seedQnaResponses(
  pollId: string,
  participantIds: string[],
  idPrefix: string,
  questions: string[] = SAMPLE_QNA,
) {
  for (let i = 0; i < Math.min(participantIds.length, questions.length); i++) {
    await prisma.pollResponse.upsert({
      where: { id: `${idPrefix}-qna-${i}` },
      update: { textAnswer: questions[i] },
      create: {
        id: `${idPrefix}-qna-${i}`,
        pollId,
        participantId: participantIds[i]!,
        textAnswer: questions[i]!,
        isOnScreen: i === 0,
      },
    });
  }
}

export async function seedQuizResponses(
  pollId: string,
  correctOptionId: string,
  wrongOptionId: string,
  participantIds: string[],
  idPrefix: string,
) {
  for (let i = 0; i < participantIds.length; i++) {
    await prisma.pollResponse.upsert({
      where: { id: `${idPrefix}-qz-${i}` },
      update: {},
      create: {
        id: `${idPrefix}-qz-${i}`,
        pollId,
        participantId: participantIds[i]!,
        optionId: i % 4 === 3 ? wrongOptionId : correctOptionId,
      },
    });
  }
}

export async function seedSingleChoiceResponses(
  pollId: string,
  optionIds: string[],
  participantIds: string[],
  idPrefix: string,
) {
  for (let i = 0; i < participantIds.length; i++) {
    await prisma.pollResponse.upsert({
      where: { id: `${idPrefix}-s-${i}` },
      update: {},
      create: {
        id: `${idPrefix}-s-${i}`,
        pollId,
        participantId: participantIds[i]!,
        optionId: optionIds[i % optionIds.length]!,
      },
    });
  }
}

/** 一次为多种 Poll 类型写入模拟提交 */
export async function seedPollSubmissionPack(params: {
  prefix: string;
  participantIds: string[];
  single?: { pollId: string; optionIds: string[] };
  multi?: { pollId: string; optionIds: string[] };
  wordCloud?: { pollId: string; words?: string[] };
  rating?: { pollId: string };
  qna?: { pollId: string; questions?: string[] };
  quiz?: { pollId: string; correctOptionId: string; wrongOptionId: string };
}) {
  const { prefix, participantIds } = params;
  if (!participantIds.length) return;

  if (params.single) {
    await seedSingleChoiceResponses(
      params.single.pollId,
      params.single.optionIds,
      participantIds,
      `${prefix}-single`,
    );
  }
  if (params.multi) {
    await seedMultiChoiceResponses(
      params.multi.pollId,
      params.multi.optionIds,
      participantIds,
      `${prefix}-multi`,
    );
  }
  if (params.wordCloud) {
    await seedWordCloudResponses(
      params.wordCloud.pollId,
      participantIds,
      `${prefix}`,
      params.wordCloud.words,
    );
  }
  if (params.rating) {
    await seedRatingResponses(params.rating.pollId, participantIds, `${prefix}`);
  }
  if (params.qna) {
    await seedQnaResponses(
      params.qna.pollId,
      participantIds,
      `${prefix}`,
      params.qna.questions,
    );
  }
  if (params.quiz) {
    await seedQuizResponses(
      params.quiz.pollId,
      params.quiz.correctOptionId,
      params.quiz.wrongOptionId,
      participantIds,
      `${prefix}`,
    );
  }
}
