/**
 * 活动互动演示数据 — Poll / Lottery / InteractionSession 全类型覆盖
 */
import "dotenv/config";
import { fileURLToPath } from "node:url";
import {
  InteractionOwnerType,
  LotteryEntrySource,
  LotteryStatus,
  LotteryType,
  PollStatus,
  PollType,
  Prisma,
  SignalType,
} from "@prisma/client";
import { prisma } from "../src/client";

/** 固定 ID，便于 upsert 与清理 */
export const SEED_INT = {
  // 智链未来产业博览会 2026 — 主办展会（008）
  hostedExpo: {
    pollSingle: "seed-int-hosted-poll-single",
    pollSingleOpt1: "seed-int-hosted-poll-single-o1",
    pollSingleOpt2: "seed-int-hosted-poll-single-o2",
    pollSingleOpt3: "seed-int-hosted-poll-single-o3",
    pollMulti: "seed-int-hosted-poll-multi",
    pollMultiO1: "seed-int-hosted-poll-multi-o1",
    pollMultiO2: "seed-int-hosted-poll-multi-o2",
    pollMultiO3: "seed-int-hosted-poll-multi-o3",
    pollWordCloud: "seed-int-hosted-poll-wc",
    pollRating: "seed-int-hosted-poll-rating",
    pollQna: "seed-int-hosted-poll-qna",
    pollAnnouncement: "seed-int-hosted-poll-ann",
    pollQuiz: "seed-int-hosted-poll-quiz",
    pollQuizO1: "seed-int-hosted-poll-quiz-o1",
    pollQuizO2: "seed-int-hosted-poll-quiz-o2",
    pollDraft: "seed-int-hosted-poll-draft",
    lotteryRandom: "seed-int-hosted-lottery-random",
    lotteryRandomFinished: "seed-int-hosted-lottery-done",
    lotteryCheckin: "seed-int-hosted-lottery-checkin",
    lotteryActivity: "seed-int-hosted-lottery-activity",
    lotteryQuiz: "seed-int-hosted-lottery-quiz",
    sessionPoll: "seed-int-hosted-session-poll",
    sessionLottery: "seed-int-hosted-session-lottery",
    sessionBooth: "seed-int-hosted-session-booth",
    sessionCodePoll: "SEED01",
    sessionCodeLottery: "SEED02",
    sessionCodeBooth: "SEEDB1",
  },
  // 2025 企业数字化展览会 — 参展侧补充
  expo: {
    pollSingle: "seed-int-expo-poll-single",
    pollSingleO1: "seed-int-expo-poll-single-o1",
    pollSingleO2: "seed-int-expo-poll-single-o2",
    lotteryOpen: "seed-int-expo-lottery-open",
    sessionPoll: "seed-int-expo-session-poll",
    sessionCode: "SEEDX1",
  },
  // SaaS 增长峰会 — 会议 Q&A
  summit: {
    pollQna: "seed-int-summit-poll-qna",
    pollSingle: "seed-int-summit-poll-single",
    pollSingleO1: "seed-int-summit-poll-single-o1",
    pollSingleO2: "seed-int-summit-poll-single-o2",
    sessionQna: "seed-int-summit-session-qna",
    sessionCode: "SEEDS1",
  },
} as const;

const ALL_SEED_POLL_IDS = [
  ...Object.values(SEED_INT.hostedExpo).filter((id) => id.startsWith("seed-int-hosted-poll")),
  ...Object.values(SEED_INT.expo).filter((id) => id.startsWith("seed-int-expo-poll")),
  ...Object.values(SEED_INT.summit).filter((id) => id.startsWith("seed-int-summit-poll")),
  "seed-int-expo-booth-poll",
  "seed-int-hosted-booth-poll",
];

const ALL_SEED_LOTTERY_IDS = [
  SEED_INT.hostedExpo.lotteryRandom,
  SEED_INT.hostedExpo.lotteryRandomFinished,
  SEED_INT.hostedExpo.lotteryCheckin,
  SEED_INT.hostedExpo.lotteryActivity,
  SEED_INT.hostedExpo.lotteryQuiz,
  SEED_INT.expo.lotteryOpen,
];

const ALL_SEED_SESSION_IDS = [
  SEED_INT.hostedExpo.sessionPoll,
  SEED_INT.hostedExpo.sessionLottery,
  SEED_INT.hostedExpo.sessionBooth,
  SEED_INT.expo.sessionPoll,
  SEED_INT.summit.sessionQna,
  "seed-int-expo-booth-session",
];

const DEFAULT_PRIZES = [
  { rank: 1, name: "一等奖", prize: "iPad Air", count: 1 },
  { rank: 2, name: "二等奖", prize: "AirPods Pro", count: 2 },
  { rank: 3, name: "三等奖", prize: "ConnectIQ 周边礼包", count: 5 },
];

export type SeedInteractionsContext = {
  hostedExpoEventId: string;
  expoEventId: string;
  summitEventId: string;
  unifiedAdminId: string;
  expoAdminId: string;
  confAdminId: string;
  endUserIds: string[];
  hostedParticipantIds: string[];
  expoParticipantIds: string[];
  hostedBoothA101Id?: string | null;
  unifiedBoothC18Id?: string | null;
  unifiedOrgId?: string | null;
};

export async function clearSeedInteractionData() {
  await prisma.interactionSession.deleteMany({
    where: { id: { in: [...ALL_SEED_SESSION_IDS] } },
  });
  await prisma.lotteryWinner.deleteMany({
    where: { lotteryId: { in: ALL_SEED_LOTTERY_IDS } },
  });
  await prisma.lotteryEntry.deleteMany({
    where: { lotteryId: { in: ALL_SEED_LOTTERY_IDS } },
  });
  await prisma.lottery.deleteMany({
    where: { id: { in: ALL_SEED_LOTTERY_IDS } },
  });
  await prisma.pollResponse.deleteMany({
    where: { pollId: { in: ALL_SEED_POLL_IDS } },
  });
  await prisma.pollOption.deleteMany({
    where: { pollId: { in: ALL_SEED_POLL_IDS } },
  });
  await prisma.poll.deleteMany({
    where: { id: { in: ALL_SEED_POLL_IDS } },
  });
}

async function upsertPoll(params: {
  id: string;
  eventId: string;
  createdById: string;
  type: PollType;
  title: string;
  status: PollStatus;
  displayOrder?: number;
  options?: Array<{ id: string; text: string; displayOrder: number }>;
}) {
  await prisma.poll.upsert({
    where: { id: params.id },
    update: {
      title: params.title,
      status: params.status,
      type: params.type,
      displayOrder: params.displayOrder ?? 0,
    },
    create: {
      id: params.id,
      eventId: params.eventId,
      createdById: params.createdById,
      type: params.type,
      title: params.title,
      status: params.status,
      showResults: true,
      displayOrder: params.displayOrder ?? 0,
    },
  });

  if (params.options?.length) {
    for (const opt of params.options) {
      await prisma.pollOption.upsert({
        where: { id: opt.id },
        update: { text: opt.text, displayOrder: opt.displayOrder },
        create: {
          id: opt.id,
          pollId: params.id,
          text: opt.text,
          displayOrder: opt.displayOrder,
        },
      });
    }
  }
}

async function upsertSession(params: {
  id: string;
  eventId: string;
  createdById: string;
  name: string;
  sessionCode: string;
  interactions: Prisma.InputJsonValue;
  ownerType?: InteractionOwnerType;
  boothId?: string | null;
  exhibitorOrgId?: string | null;
  scanCount?: number;
  participantCount?: number;
  settings?: Prisma.InputJsonValue;
}) {
  await prisma.interactionSession.upsert({
    where: { id: params.id },
    update: {
      name: params.name,
      sessionCode: params.sessionCode,
      interactions: params.interactions,
      isActive: true,
      scanCount: params.scanCount ?? 0,
      participantCount: params.participantCount ?? 0,
      settings: params.settings ?? {},
    },
    create: {
      id: params.id,
      eventId: params.eventId,
      createdById: params.createdById,
      name: params.name,
      sessionCode: params.sessionCode,
      qrUrl: `https://connectiq.local/i/${params.sessionCode}`,
      interactions: params.interactions,
      ownerType: params.ownerType ?? InteractionOwnerType.ORGANIZER,
      boothId: params.boothId ?? null,
      exhibitorOrgId: params.exhibitorOrgId ?? null,
      isActive: true,
      scanCount: params.scanCount ?? 0,
      participantCount: params.participantCount ?? 0,
      settings: params.settings ?? {},
    },
  });
}

async function setEventFeatureFlags(eventId: string) {
  await prisma.event.update({
    where: { id: eventId },
    data: {
      featureFlags: {
        lottery: true,
        stampRally: true,
        boothRanking: true,
        eventSummary: true,
        speedNetworking: false,
        aiBoothRoute: false,
        aiReferral: false,
        highValueBuyerPush: false,
        inviteSystem: false,
      },
    },
  });
}

async function setQnaDisplayConfig(
  eventId: string,
  pollId: string,
  config: {
    pinnedResponseIds?: string[];
    answeredResponseIds?: string[];
    hiddenResponseIds?: string[];
    featuredResponseId?: string | null;
    responseMeta?: Record<string, { hostNote?: string; publicReply?: string }>;
  },
) {
  const key = `bigscreen_display_${pollId}`;
  await prisma.eventSetting.upsert({
    where: { eventId_key: { eventId, key } },
    create: {
      eventId,
      key,
      value: {
        showResults: true,
        lockVotes: false,
        featuredResponseId: config.featuredResponseId ?? null,
        hiddenResponseIds: config.hiddenResponseIds ?? [],
        pinnedResponseIds: config.pinnedResponseIds ?? [],
        answeredResponseIds: config.answeredResponseIds ?? [],
        responseMeta: config.responseMeta ?? {},
      },
    },
    update: {
      value: {
        showResults: true,
        lockVotes: false,
        featuredResponseId: config.featuredResponseId ?? null,
        hiddenResponseIds: config.hiddenResponseIds ?? [],
        pinnedResponseIds: config.pinnedResponseIds ?? [],
        answeredResponseIds: config.answeredResponseIds ?? [],
        responseMeta: config.responseMeta ?? {},
      },
    },
  });
}

async function seedHostedExpoInteractions(ctx: SeedInteractionsContext) {
  const H = SEED_INT.hostedExpo;
  const { hostedExpoEventId: eventId, unifiedAdminId: creatorId } = ctx;

  await setEventFeatureFlags(eventId);

  // ── Poll 套件（6 种 LIVE + 1 DRAFT + 测验题）──
  await upsertPoll({
    id: H.pollSingle,
    eventId,
    createdById: creatorId,
    type: PollType.SINGLE_CHOICE,
    title: "【现场投票】您最关注哪个展区主题？",
    status: PollStatus.LIVE,
    displayOrder: 1,
    options: [
      { id: H.pollSingleOpt1, text: "智能制造", displayOrder: 1 },
      { id: H.pollSingleOpt2, text: "企业服务 SaaS", displayOrder: 2 },
      { id: H.pollSingleOpt3, text: "MarTech 营销科技", displayOrder: 3 },
    ],
  });

  await upsertPoll({
    id: H.pollMulti,
    eventId,
    createdById: creatorId,
    type: PollType.MULTI_CHOICE,
    title: "【多选】您希望下届展会增加哪些内容？",
    status: PollStatus.LIVE,
    displayOrder: 2,
    options: [
      { id: H.pollMultiO1, text: "更多标杆案例分享", displayOrder: 1 },
      { id: H.pollMultiO2, text: "一对一商务洽谈", displayOrder: 2 },
      { id: H.pollMultiO3, text: "沉浸式产品体验区", displayOrder: 3 },
    ],
  });

  await upsertPoll({
    id: H.pollWordCloud,
    eventId,
    createdById: creatorId,
    type: PollType.WORD_CLOUD,
    title: "【词云】用一个词形容今天的展会",
    status: PollStatus.LIVE,
    displayOrder: 3,
  });

  await upsertPoll({
    id: H.pollRating,
    eventId,
    createdById: creatorId,
    type: PollType.RATING,
    title: "【评分】您对开幕式的满意度",
    status: PollStatus.LIVE,
    displayOrder: 4,
  });

  await upsertPoll({
    id: H.pollQna,
    eventId,
    createdById: creatorId,
    type: PollType.QNA,
    title: "【问答】向主办方提问",
    status: PollStatus.LIVE,
    displayOrder: 5,
  });

  await upsertPoll({
    id: H.pollAnnouncement,
    eventId,
    createdById: creatorId,
    type: PollType.ANNOUNCEMENT,
    title: "【公告】下午 14:00 主论坛即将开始，请移步 A 区",
    status: PollStatus.LIVE,
    displayOrder: 6,
  });

  await upsertPoll({
    id: H.pollQuiz,
    eventId,
    createdById: creatorId,
    type: PollType.SINGLE_CHOICE,
    title: "【答题抽奖】ConnectIQ 支持几种现场互动类型？",
    status: PollStatus.LIVE,
    displayOrder: 7,
    options: [
      { id: H.pollQuizO1, text: "3 种", displayOrder: 1 },
      { id: H.pollQuizO2, text: "6 种投票 + 抽奖", displayOrder: 2 },
    ],
  });

  await upsertPoll({
    id: H.pollDraft,
    eventId,
    createdById: creatorId,
    type: PollType.SINGLE_CHOICE,
    title: "【筹备中】闭幕满意度调查（未上线）",
    status: PollStatus.DRAFT,
    displayOrder: 99,
  });

  // ── PollResponse ──
  const participants = ctx.hostedParticipantIds;
  const wordCloudWords = [
    "专业",
    "高效",
    "创新",
    "连接",
    "专业",
    "惊喜",
    "干货",
    "专业",
    "值得",
    "期待",
    "智能",
    "连接",
  ];

  for (let i = 0; i < participants.length; i++) {
    const pid = participants[i]!;
    const optIdx = i % 3;

    await prisma.pollResponse.upsert({
      where: { id: `seed-int-res-hosted-single-${i}` },
      update: {},
      create: {
        id: `seed-int-res-hosted-single-${i}`,
        pollId: H.pollSingle,
        participantId: pid,
        optionId: [H.pollSingleOpt1, H.pollSingleOpt2, H.pollSingleOpt3][optIdx],
      },
    });

    for (let j = 0; j <= i % 2; j++) {
      await prisma.pollResponse.upsert({
        where: { id: `seed-int-res-hosted-multi-${i}-${j}` },
        update: {},
        create: {
          id: `seed-int-res-hosted-multi-${i}-${j}`,
          pollId: H.pollMulti,
          participantId: pid,
          optionId: [H.pollMultiO1, H.pollMultiO2, H.pollMultiO3][j],
        },
      });
    }

    await prisma.pollResponse.upsert({
      where: { id: `seed-int-res-hosted-wc-${i}` },
      update: {},
      create: {
        id: `seed-int-res-hosted-wc-${i}`,
        pollId: H.pollWordCloud,
        participantId: pid,
        textAnswer: wordCloudWords[i % wordCloudWords.length],
      },
    });

    await prisma.pollResponse.upsert({
      where: { id: `seed-int-res-hosted-rating-${i}` },
      update: {},
      create: {
        id: `seed-int-res-hosted-rating-${i}`,
        pollId: H.pollRating,
        participantId: pid,
        rating: (i % 5) + 1,
      },
    });

    await prisma.pollResponse.upsert({
      where: { id: `seed-int-res-hosted-quiz-${i}` },
      update: {},
      create: {
        id: `seed-int-res-hosted-quiz-${i}`,
        pollId: H.pollQuiz,
        participantId: pid,
        optionId: i % 2 === 0 ? H.pollQuizO2 : H.pollQuizO1,
      },
    });
  }

  const qnaQuestions = [
    { id: "seed-int-res-hosted-qna-1", text: "下午主论坛是否有回放？", participantIdx: 0 },
    { id: "seed-int-res-hosted-qna-2", text: "下午主论坛是否有回放？", participantIdx: 1 },
    { id: "seed-int-res-hosted-qna-3", text: "下午主论坛是否有回放？", participantIdx: 2 },
    { id: "seed-int-res-hosted-qna-4", text: "如何预约一对一商务洽谈？", participantIdx: 1 },
    { id: "seed-int-res-hosted-qna-5", text: "展商名录在哪里下载？", participantIdx: 3 },
    { id: "seed-int-res-hosted-qna-6", text: "停车券如何领取？", participantIdx: 4 },
    { id: "seed-int-res-hosted-qna-7", text: "AI 匹配功能什么时候开放？", participantIdx: 0 },
  ];

  for (const q of qnaQuestions) {
    await prisma.pollResponse.upsert({
      where: { id: q.id },
      update: { textAnswer: q.text },
      create: {
        id: q.id,
        pollId: H.pollQna,
        participantId: participants[q.participantIdx] ?? participants[0],
        textAnswer: q.text,
        isOnScreen: q.id === "seed-int-res-hosted-qna-1",
      },
    });
  }

  await setQnaDisplayConfig(eventId, H.pollQna, {
    pinnedResponseIds: ["seed-int-res-hosted-qna-4"],
    answeredResponseIds: ["seed-int-res-hosted-qna-6"],
    featuredResponseId: "seed-int-res-hosted-qna-1",
    responseMeta: {
      "seed-int-res-hosted-qna-6": {
        hostNote: "已在服务台发放",
        publicReply: "请前往北厅服务台凭参会证领取",
      },
    },
  });

  // ── Lottery 套件 ──
  await prisma.lottery.upsert({
    where: { id: H.lotteryRandom },
    update: { status: LotteryStatus.OPEN, entryCount: ctx.endUserIds.length },
    create: {
      id: H.lotteryRandom,
      eventId,
      createdById: creatorId,
      title: "【随机抽奖】开幕幸运奖",
      description: "扫码参与，现场随机抽取 ConnectIQ 周边",
      type: LotteryType.RANDOM,
      status: LotteryStatus.OPEN,
      prizes: DEFAULT_PRIZES,
      winnerCount: 3,
      entryCount: 0,
    },
  });

  await prisma.lottery.upsert({
    where: { id: H.lotteryRandomFinished },
    update: {},
    create: {
      id: H.lotteryRandomFinished,
      eventId,
      createdById: creatorId,
      title: "【已开奖】昨日预热抽奖",
      type: LotteryType.RANDOM,
      status: LotteryStatus.FINISHED,
      prizes: DEFAULT_PRIZES,
      winnerCount: 1,
      entryCount: 3,
      drawnAt: new Date(Date.now() - 86_400_000),
    },
  });

  await prisma.lottery.upsert({
    where: { id: H.lotteryCheckin },
    update: {},
    create: {
      id: H.lotteryCheckin,
      eventId,
      createdById: creatorId,
      title: "【签到抽奖】已签到观众专属",
      type: LotteryType.CHECKIN_BASED,
      status: LotteryStatus.OPEN,
      requireCheckin: true,
      prizes: DEFAULT_PRIZES.slice(0, 2),
      winnerCount: 2,
    },
  });

  await prisma.lottery.upsert({
    where: { id: H.lotteryActivity },
    update: { requirePollId: H.pollSingle },
    create: {
      id: H.lotteryActivity,
      eventId,
      createdById: creatorId,
      title: "【参与抽奖】完成现场投票后可抽",
      type: LotteryType.ACTIVITY_BASED,
      status: LotteryStatus.OPEN,
      requirePollId: H.pollSingle,
      prizes: DEFAULT_PRIZES.slice(0, 1),
      winnerCount: 1,
    },
  });

  await prisma.lottery.upsert({
    where: { id: H.lotteryQuiz },
    update: { quizPollId: H.pollQuiz },
    create: {
      id: H.lotteryQuiz,
      eventId,
      createdById: creatorId,
      title: "【答题抽奖】答对互动知识题参与",
      type: LotteryType.QUIZ_BASED,
      status: LotteryStatus.OPEN,
      quizPollId: H.pollQuiz,
      prizes: DEFAULT_PRIZES.slice(0, 2),
      winnerCount: 2,
    },
  });

  for (let i = 0; i < Math.min(ctx.endUserIds.length, 6); i++) {
    const userId = ctx.endUserIds[i]!;
    await prisma.lotteryEntry.upsert({
      where: { lotteryId_userId: { lotteryId: H.lotteryRandom, userId } },
      update: {},
      create: {
        id: `seed-int-entry-random-${i}`,
        lotteryId: H.lotteryRandom,
        userId,
        source: LotteryEntrySource.MANUAL,
      },
    });
  }

  if (ctx.endUserIds[0]) {
    await prisma.lotteryWinner.upsert({
      where: { id: "seed-int-winner-finished-1" },
      update: {},
      create: {
        id: "seed-int-winner-finished-1",
        lotteryId: H.lotteryRandomFinished,
        userId: ctx.endUserIds[0],
        prizeRank: 1,
        prizeName: "一等奖 · iPad Air",
        notified: true,
      },
    });
  }

  // ── InteractionSession ──
  await upsertSession({
    id: H.sessionPoll,
    eventId,
    createdById: creatorId,
    name: "现场投票 · 展区主题",
    sessionCode: H.sessionCodePoll,
    interactions: [{ type: "poll", id: H.pollSingle }],
    scanCount: 128,
    participantCount: participants.length,
  });

  await upsertSession({
    id: H.sessionLottery,
    eventId,
    createdById: creatorId,
    name: "开幕幸运抽奖",
    sessionCode: H.sessionCodeLottery,
    interactions: [{ type: "lottery", id: H.lotteryRandom }],
    scanCount: 86,
    participantCount: Math.min(ctx.endUserIds.length, 6),
  });

  if (ctx.hostedBoothA101Id) {
    await upsertPoll({
      id: "seed-int-hosted-booth-poll",
      eventId,
      createdById: creatorId,
      type: PollType.RATING,
      title: "【展位】您对本次演示的满意度",
      status: PollStatus.LIVE,
      displayOrder: 10,
    });

    await upsertSession({
      id: H.sessionBooth,
      eventId,
      createdById: creatorId,
      name: "A-101 展位现场互动",
      sessionCode: H.sessionCodeBooth,
      interactions: [{ type: "poll", id: "seed-int-hosted-booth-poll" }],
      ownerType: InteractionOwnerType.EXHIBITOR,
      boothId: ctx.hostedBoothA101Id,
      exhibitorOrgId: ctx.unifiedOrgId ?? null,
      settings: { requireLeadCapture: true },
      scanCount: 42,
      participantCount: 8,
    });
  }

  // 行为信号（大屏 / 排行）
  if (ctx.endUserIds[0]) {
    await prisma.boothVisitSignal.createMany({
      data: [
        {
          userId: ctx.endUserIds[0],
          eventId,
          signalType: SignalType.POLL_ANSWERED,
          entityId: H.pollSingle,
          entityType: "POLL",
          payload: { source: "seed_interaction" },
        },
        {
          userId: ctx.endUserIds[1] ?? ctx.endUserIds[0],
          eventId,
          signalType: SignalType.QNA_ASKED,
          entityId: H.pollQna,
          entityType: "POLL",
          payload: { source: "seed_interaction" },
        },
        {
          userId: ctx.endUserIds[2] ?? ctx.endUserIds[0],
          eventId,
          signalType: SignalType.INTERACTION_JOINED,
          entityId: H.sessionPoll,
          entityType: "INTERACTION_SESSION",
          payload: { sessionCode: H.sessionCodePoll },
        },
      ],
      skipDuplicates: true,
    });
  }
}

async function seedExpoInteractions(ctx: SeedInteractionsContext) {
  const E = SEED_INT.expo;
  const { expoEventId: eventId, expoAdminId: creatorId } = ctx;

  await setEventFeatureFlags(eventId);

  await upsertPoll({
    id: E.pollSingle,
    eventId,
    createdById: creatorId,
    type: PollType.SINGLE_CHOICE,
    title: "【展会】您本次逛展的主要目的？",
    status: PollStatus.LIVE,
    options: [
      { id: E.pollSingleO1, text: "寻找供应商", displayOrder: 1 },
      { id: E.pollSingleO2, text: "了解行业趋势", displayOrder: 2 },
    ],
  });

  for (let i = 0; i < ctx.expoParticipantIds.length; i++) {
    await prisma.pollResponse.upsert({
      where: { id: `seed-int-res-expo-single-${i}` },
      update: {},
      create: {
        id: `seed-int-res-expo-single-${i}`,
        pollId: E.pollSingle,
        participantId: ctx.expoParticipantIds[i],
        optionId: i % 2 === 0 ? E.pollSingleO1 : E.pollSingleO2,
      },
    });
  }

  await prisma.lottery.upsert({
    where: { id: E.lotteryOpen },
    update: {},
    create: {
      id: E.lotteryOpen,
      eventId,
      createdById: creatorId,
      title: "【展会】逛展幸运抽",
      type: LotteryType.RANDOM,
      status: LotteryStatus.OPEN,
      prizes: DEFAULT_PRIZES.slice(0, 2),
      winnerCount: 2,
      entryCount: 2,
    },
  });

  if (ctx.endUserIds[2]) {
    await prisma.lotteryEntry.upsert({
      where: {
        lotteryId_userId: { lotteryId: E.lotteryOpen, userId: ctx.endUserIds[2] },
      },
      update: {},
      create: {
        id: "seed-int-entry-expo-1",
        lotteryId: E.lotteryOpen,
        userId: ctx.endUserIds[2],
        source: LotteryEntrySource.MANUAL,
      },
    });
  }

  await upsertSession({
    id: E.sessionPoll,
    eventId,
    createdById: creatorId,
    name: "逛展目的投票",
    sessionCode: E.sessionCode,
    interactions: [{ type: "poll", id: E.pollSingle }],
    scanCount: 55,
    participantCount: ctx.expoParticipantIds.length,
  });

  if (ctx.unifiedBoothC18Id && ctx.unifiedOrgId) {
    await upsertPoll({
      id: "seed-int-expo-booth-poll",
      eventId,
      createdById: ctx.unifiedAdminId,
      type: PollType.QNA,
      title: "【ConnectIQ 展台】向产品团队提问",
      status: PollStatus.LIVE,
    });

    await upsertSession({
      id: "seed-int-expo-booth-session",
      eventId,
      createdById: ctx.unifiedAdminId,
      name: "C-18 ConnectIQ 展台互动",
      sessionCode: "SEEDC18",
      interactions: [{ type: "poll", id: "seed-int-expo-booth-poll" }],
      ownerType: InteractionOwnerType.EXHIBITOR,
      boothId: ctx.unifiedBoothC18Id,
      exhibitorOrgId: ctx.unifiedOrgId,
      settings: { requireLeadCapture: true },
      scanCount: 31,
      participantCount: 4,
    });
  }
}

async function seedSummitInteractions(ctx: SeedInteractionsContext) {
  const S = SEED_INT.summit;
  const { summitEventId: eventId, confAdminId: creatorId } = ctx;

  await upsertPoll({
    id: S.pollSingle,
    eventId,
    createdById: creatorId,
    type: PollType.SINGLE_CHOICE,
    title: "【峰会】哪个主题演讲最有收获？",
    status: PollStatus.LIVE,
    options: [
      { id: S.pollSingleO1, text: "增长方法论", displayOrder: 1 },
      { id: S.pollSingleO2, text: "AI 赋能销售", displayOrder: 2 },
    ],
  });

  await upsertPoll({
    id: S.pollQna,
    eventId,
    createdById: creatorId,
    type: PollType.QNA,
    title: "【峰会问答】向嘉宾提问",
    status: PollStatus.LIVE,
  });

  await prisma.pollResponse.createMany({
    data: [
      {
        id: "seed-int-res-summit-qna-1",
        pollId: S.pollQna,
        textAnswer: "如何衡量 PLG 与 SLG 的 ROI？",
      },
      {
        id: "seed-int-res-summit-qna-2",
        pollId: S.pollQna,
        textAnswer: "如何衡量 PLG 与 SLG 的 ROI？",
      },
      {
        id: "seed-int-res-summit-qna-3",
        pollId: S.pollQna,
        textAnswer: "中小企业如何搭建客户成功团队？",
      },
    ],
    skipDuplicates: true,
  });

  await upsertSession({
    id: S.sessionQna,
    eventId,
    createdById: creatorId,
    name: "主论坛现场问答",
    sessionCode: S.sessionCode,
    interactions: [{ type: "poll", id: S.pollQna }],
    scanCount: 210,
    participantCount: 3,
  });
}

export async function seedInteractionDemoData(ctx: SeedInteractionsContext) {
  await clearSeedInteractionData();
  await seedHostedExpoInteractions(ctx);
  await seedExpoInteractions(ctx);
  await seedSummitInteractions(ctx);

  return {
    sessionCodes: {
      hostedPoll: SEED_INT.hostedExpo.sessionCodePoll,
      hostedLottery: SEED_INT.hostedExpo.sessionCodeLottery,
      hostedBooth: SEED_INT.hostedExpo.sessionCodeBooth,
      expo: SEED_INT.expo.sessionCode,
      summit: SEED_INT.summit.sessionCode,
      expoBooth: "SEEDC18",
    },
  };
}

async function main() {
  console.log("🎯 ConnectIQ 互动演示数据 seed\n");

  const [hostedExpo, expo, summit, unifiedAdmin, expoAdmin, confAdmin] =
    await Promise.all([
      prisma.event.findUnique({ where: { slug: "smart-link-industry-expo-2026" } }),
      prisma.event.findUnique({ where: { slug: "enterprise-digital-expo-2025" } }),
      prisma.event.findUnique({ where: { slug: "saas-growth-summit-2025" } }),
      prisma.user.findUnique({
        where: { email: "13800000008@phone.connectiq.local" },
      }),
      prisma.user.findUnique({
        where: { email: "13800000003@phone.connectiq.local" },
      }),
      prisma.user.findUnique({
        where: { email: "13800000002@phone.connectiq.local" },
      }),
    ]);

  if (!hostedExpo || !expo || !summit) {
    throw new Error("请先运行 pnpm db:seed 创建基础活动数据");
  }
  if (!unifiedAdmin || !expoAdmin || !confAdmin) {
    throw new Error("缺少测试管理员账号，请先运行 pnpm db:seed");
  }

  const endUsers = await prisma.user.findMany({
    where: { phone: { startsWith: "139" } },
    select: { id: true },
    take: 10,
  });

  const hostedParticipants = await prisma.participant.findMany({
    where: { eventId: hostedExpo.id, id: { startsWith: "seed-part-smart-expo" } },
    select: { id: true },
  });

  const expoParticipants = await prisma.participant.findMany({
    where: {
      eventId: expo.id,
      OR: [
        { id: { startsWith: "seed-part-digital-expo" } },
        { email: { contains: "seed.connectiq.local" } },
      ],
    },
    select: { id: true },
  });

  const hostedBooth = await prisma.exhibitorBooth.findFirst({
    where: { eventId: hostedExpo.id, code: "A-101" },
  });
  const unifiedBooth = await prisma.exhibitorBooth.findFirst({
    where: { eventId: expo.id, code: "C-18" },
  });

  const unifiedOrg = await prisma.organization.findUnique({
    where: { slug: "connectiq-innovation-hub" },
  });

  const result = await seedInteractionDemoData({
    hostedExpoEventId: hostedExpo.id,
    expoEventId: expo.id,
    summitEventId: summit.id,
    unifiedAdminId: unifiedAdmin.id,
    expoAdminId: expoAdmin.id,
    confAdminId: confAdmin.id,
    endUserIds: endUsers.map((u) => u.id),
    hostedParticipantIds: hostedParticipants.map((p) => p.id),
    expoParticipantIds: expoParticipants.map((p) => p.id),
    hostedBoothA101Id: hostedBooth?.id,
    unifiedBoothC18Id: unifiedBooth?.id,
    unifiedOrgId: unifiedOrg?.id,
  });

  console.log("✅ 互动 seed 完成\n");
  console.log("── 扫码演示链接（/i/{code}）──");
  console.log(`  主办展会投票:     ${result.sessionCodes.hostedPoll}`);
  console.log(`  主办展会抽奖:     ${result.sessionCodes.hostedLottery}`);
  console.log(`  主办展位 A-101:   ${result.sessionCodes.hostedBooth}`);
  console.log(`  数字化展览投票:   ${result.sessionCodes.expo}`);
  console.log(`  参展 C-18 展台:   ${result.sessionCodes.expoBooth}`);
  console.log(`  峰会问答:         ${result.sessionCodes.summit}`);
  console.log("\n── Poll 类型（智链博览会 LIVE）──");
  console.log("  单选 / 多选 / 词云 / 评分 / 问答 / 公告 / 答题 + 1 草稿");
  console.log("\n── Lottery 类型 ──");
  console.log("  随机(OPEN) / 已开奖 / 签到 / 参与门槛 / 答题");
}

const isDirectRun =
  process.argv[1] === fileURLToPath(import.meta.url);

if (isDirectRun) {
  main()
    .catch((err) => {
      console.error(err);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
