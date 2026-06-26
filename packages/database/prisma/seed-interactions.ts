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
import {
  seedLotteryEntries,
  seedMultiChoiceResponses,
  seedPollSubmissionPack,
  seedQnaResponses,
  seedQuizResponses,
  seedRatingResponses,
  seedWordCloudResponses,
} from "./seed-interaction-responses";

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
    pollMulti: "seed-int-expo-poll-multi",
    pollMultiO1: "seed-int-expo-poll-multi-o1",
    pollMultiO2: "seed-int-expo-poll-multi-o2",
    pollMultiO3: "seed-int-expo-poll-multi-o3",
    pollRating: "seed-int-expo-poll-rating",
    pollWordCloud: "seed-int-expo-poll-wc",
    pollQna: "seed-int-expo-poll-qna",
    pollSurvey: "seed-int-expo-poll-survey",
    pollSurveyO1: "seed-int-expo-poll-survey-o1",
    pollSurveyO2: "seed-int-expo-poll-survey-o2",
    pollSurveyO3: "seed-int-expo-poll-survey-o3",
    pollQuiz: "seed-int-expo-poll-quiz",
    pollQuizO1: "seed-int-expo-poll-quiz-o1",
    pollQuizO2: "seed-int-expo-poll-quiz-o2",
    lotteryOpen: "seed-int-expo-lottery-open",
    lotteryCheckin: "seed-int-expo-lottery-checkin",
    lotteryQuiz: "seed-int-expo-lottery-quiz",
    lotteryActivity: "seed-int-expo-lottery-activity",
    sessionPoll: "seed-int-expo-session-poll",
    sessionLottery: "seed-int-expo-session-lottery",
    sessionCode: "SEEDX1",
    sessionCodeLottery: "SEEDX2",
  },
  // SaaS 增长峰会 — 会议 Q&A
  summit: {
    pollQna: "seed-int-summit-poll-qna",
    pollSingle: "seed-int-summit-poll-single",
    pollSingleO1: "seed-int-summit-poll-single-o1",
    pollSingleO2: "seed-int-summit-poll-single-o2",
    pollMulti: "seed-int-summit-poll-multi",
    pollMultiO1: "seed-int-summit-poll-multi-o1",
    pollMultiO2: "seed-int-summit-poll-multi-o2",
    pollRating: "seed-int-summit-poll-rating",
    pollWordCloud: "seed-int-summit-poll-wc",
    pollAnnouncement: "seed-int-summit-poll-ann",
    lotteryRandom: "seed-int-summit-lottery-random",
    lotteryQuiz: "seed-int-summit-lottery-quiz",
    pollQuiz: "seed-int-summit-poll-quiz",
    pollQuizO1: "seed-int-summit-poll-quiz-o1",
    pollQuizO2: "seed-int-summit-poll-quiz-o2",
    sessionQna: "seed-int-summit-session-qna",
    sessionPoll: "seed-int-summit-session-poll",
    sessionLottery: "seed-int-summit-session-lottery",
    sessionCodeQna: "SEEDS1",
    sessionCodePoll: "SEEDS2",
    sessionCodeLottery: "SEEDS3",
  },
  // 创新活动运营峰会 2025（008 主办会议）
  innovation: {
    pollSingle: "seed-int-innovation-poll-single",
    pollSingleO1: "seed-int-innovation-poll-single-o1",
    pollSingleO2: "seed-int-innovation-poll-single-o2",
    pollSingleO3: "seed-int-innovation-poll-single-o3",
    pollMulti: "seed-int-innovation-poll-multi",
    pollMultiO1: "seed-int-innovation-poll-multi-o1",
    pollMultiO2: "seed-int-innovation-poll-multi-o2",
    pollQna: "seed-int-innovation-poll-qna",
    pollRating: "seed-int-innovation-poll-rating",
    pollWordCloud: "seed-int-innovation-poll-wc",
    pollAnnouncement: "seed-int-innovation-poll-ann",
    pollQuiz: "seed-int-innovation-poll-quiz",
    pollQuizO1: "seed-int-innovation-poll-quiz-o1",
    pollQuizO2: "seed-int-innovation-poll-quiz-o2",
    pollSurvey: "seed-int-innovation-poll-survey",
    pollSurveyO1: "seed-int-innovation-poll-survey-o1",
    pollSurveyO2: "seed-int-innovation-poll-survey-o2",
    pollSurveyO3: "seed-int-innovation-poll-survey-o3",
    lotteryRandom: "seed-int-innovation-lottery-random",
    lotteryActivity: "seed-int-innovation-lottery-activity",
    lotteryQuiz: "seed-int-innovation-lottery-quiz",
    sessionPoll: "seed-int-innovation-session-poll",
    sessionQna: "seed-int-innovation-session-qna",
    sessionLottery: "seed-int-innovation-session-lottery",
    sessionCodePoll: "SEEDN1",
    sessionCodeQna: "SEEDN2",
    sessionCodeLottery: "SEEDN3",
  },
  // 产品增长沙龙
  salon: {
    pollSingle: "seed-int-salon-poll-single",
    pollSingleO1: "seed-int-salon-poll-single-o1",
    pollSingleO2: "seed-int-salon-poll-single-o2",
    pollMulti: "seed-int-salon-poll-multi",
    pollMultiO1: "seed-int-salon-poll-multi-o1",
    pollMultiO2: "seed-int-salon-poll-multi-o2",
    pollMultiO3: "seed-int-salon-poll-multi-o3",
    pollWordCloud: "seed-int-salon-poll-wc",
    pollSurvey: "seed-int-salon-poll-survey",
    pollSurveyO1: "seed-int-salon-poll-survey-o1",
    pollSurveyO2: "seed-int-salon-poll-survey-o2",
    pollSurveyO3: "seed-int-salon-poll-survey-o3",
    pollQna: "seed-int-salon-poll-qna",
    pollRating: "seed-int-salon-poll-rating",
    lotteryOpen: "seed-int-salon-lottery-open",
    sessionPoll: "seed-int-salon-session-poll",
    sessionQna: "seed-int-salon-session-qna",
    sessionCode: "SEEDSL",
    sessionCodeQna: "SEEDSL2",
  },
} as const;

function collectIds(obj: Record<string, string>, prefix: string) {
  return Object.values(obj).filter((id) => id.startsWith(prefix));
}

const ALL_SEED_POLL_IDS = [
  ...collectIds(SEED_INT.hostedExpo, "seed-int-hosted-poll"),
  ...collectIds(SEED_INT.expo, "seed-int-expo-poll"),
  ...collectIds(SEED_INT.summit, "seed-int-summit-poll"),
  ...collectIds(SEED_INT.innovation, "seed-int-innovation-poll"),
  ...collectIds(SEED_INT.salon, "seed-int-salon-poll"),
  "seed-int-expo-booth-poll",
  "seed-int-hosted-booth-poll",
  "seed-int-expo-booth-rating",
];

const ALL_SEED_LOTTERY_IDS = [
  SEED_INT.hostedExpo.lotteryRandom,
  SEED_INT.hostedExpo.lotteryRandomFinished,
  SEED_INT.hostedExpo.lotteryCheckin,
  SEED_INT.hostedExpo.lotteryActivity,
  SEED_INT.hostedExpo.lotteryQuiz,
  SEED_INT.expo.lotteryOpen,
  SEED_INT.expo.lotteryCheckin,
  SEED_INT.expo.lotteryQuiz,
  SEED_INT.expo.lotteryActivity,
  SEED_INT.summit.lotteryRandom,
  SEED_INT.summit.lotteryQuiz,
  SEED_INT.innovation.lotteryRandom,
  SEED_INT.innovation.lotteryActivity,
  SEED_INT.innovation.lotteryQuiz,
  SEED_INT.salon.lotteryOpen,
  "seed-int-expo-booth-lottery",
];

const ALL_SEED_SESSION_IDS = [
  SEED_INT.hostedExpo.sessionPoll,
  SEED_INT.hostedExpo.sessionLottery,
  SEED_INT.hostedExpo.sessionBooth,
  SEED_INT.expo.sessionPoll,
  SEED_INT.expo.sessionLottery,
  SEED_INT.summit.sessionQna,
  SEED_INT.summit.sessionPoll,
  SEED_INT.summit.sessionLottery,
  SEED_INT.innovation.sessionPoll,
  SEED_INT.innovation.sessionQna,
  SEED_INT.innovation.sessionLottery,
  SEED_INT.salon.sessionPoll,
  SEED_INT.salon.sessionQna,
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
  innovationSummitEventId?: string;
  salonEventId?: string;
  unifiedAdminId: string;
  expoAdminId: string;
  confAdminId: string;
  endUserIds: string[];
  hostedParticipantIds: string[];
  expoParticipantIds: string[];
  innovationParticipantIds?: string[];
  summitParticipantIds?: string[];
  salonParticipantIds?: string[];
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

type SeedFeatureFlagOverrides = Partial<{
  speedNetworking: boolean;
  inviteSystem: boolean;
  aiBoothRoute: boolean;
  aiReferral: boolean;
  highValueBuyerPush: boolean;
}>;

async function setEventFeatureFlags(
  eventId: string,
  overrides: SeedFeatureFlagOverrides = {},
) {
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
        ...overrides,
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

  await setEventFeatureFlags(eventId, { inviteSystem: true });

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

  await seedLotteryEntries(H.lotteryCheckin, ctx.endUserIds, "seed-int-entry-hosted-checkin", 5);
  await seedLotteryEntries(H.lotteryActivity, ctx.endUserIds, "seed-int-entry-hosted-activity", 5);
  await seedLotteryEntries(H.lotteryQuiz, ctx.endUserIds, "seed-int-entry-hosted-quiz", 5);

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

    await seedRatingResponses(
      "seed-int-hosted-booth-poll",
      participants.slice(0, 5),
      "seed-int-res-hosted-booth",
    );

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
  const participants = ctx.expoParticipantIds;

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

  await upsertPoll({
    id: E.pollMulti,
    eventId,
    createdById: creatorId,
    type: PollType.MULTI_CHOICE,
    title: "【多选】您关注哪些数字化方向？",
    status: PollStatus.LIVE,
    options: [
      { id: E.pollMultiO1, text: "AI 与自动化", displayOrder: 1 },
      { id: E.pollMultiO2, text: "数据治理", displayOrder: 2 },
      { id: E.pollMultiO3, text: "客户体验", displayOrder: 3 },
    ],
  });

  await upsertPoll({
    id: E.pollWordCloud,
    eventId,
    createdById: creatorId,
    type: PollType.WORD_CLOUD,
    title: "【词云】用一个词形容本次展会",
    status: PollStatus.LIVE,
  });

  await upsertPoll({
    id: E.pollRating,
    eventId,
    createdById: creatorId,
    type: PollType.RATING,
    title: "【评分】展会整体满意度",
    status: PollStatus.LIVE,
  });

  await upsertPoll({
    id: E.pollQna,
    eventId,
    createdById: creatorId,
    type: PollType.QNA,
    title: "【问答】向主办方提问",
    status: PollStatus.LIVE,
  });

  await upsertPoll({
    id: E.pollSurvey,
    eventId,
    createdById: creatorId,
    type: PollType.MULTI_CHOICE,
    title: "【问卷】您希望下届展会增加哪些服务？",
    status: PollStatus.LIVE,
    options: [
      { id: E.pollSurveyO1, text: "VIP 商务配对", displayOrder: 1 },
      { id: E.pollSurveyO2, text: "行业报告下载", displayOrder: 2 },
      { id: E.pollSurveyO3, text: "线上回放", displayOrder: 3 },
    ],
  });

  await upsertPoll({
    id: E.pollQuiz,
    eventId,
    createdById: creatorId,
    type: PollType.SINGLE_CHOICE,
    title: "【答题】B2B 展会最有效的获客方式是？",
    status: PollStatus.LIVE,
    options: [
      { id: E.pollQuizO1, text: "现场互动 + 线索收集", displayOrder: 1 },
      { id: E.pollQuizO2, text: "仅发放宣传册", displayOrder: 2 },
    ],
  });

  await seedPollSubmissionPack({
    prefix: "seed-int-res-expo",
    participantIds: participants,
    single: { pollId: E.pollSingle, optionIds: [E.pollSingleO1, E.pollSingleO2] },
    multi: { pollId: E.pollMulti, optionIds: [E.pollMultiO1, E.pollMultiO2, E.pollMultiO3] },
    wordCloud: { pollId: E.pollWordCloud },
    rating: { pollId: E.pollRating },
    qna: { pollId: E.pollQna },
    quiz: { pollId: E.pollQuiz, correctOptionId: E.pollQuizO1, wrongOptionId: E.pollQuizO2 },
  });

  await seedMultiChoiceResponses(
    E.pollSurvey,
    [E.pollSurveyO1, E.pollSurveyO2, E.pollSurveyO3],
    participants,
    "seed-int-res-expo-survey",
  );

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
    },
  });

  await prisma.lottery.upsert({
    where: { id: E.lotteryCheckin },
    update: {},
    create: {
      id: E.lotteryCheckin,
      eventId,
      createdById: creatorId,
      title: "【签到抽奖】已签到观众专属",
      type: LotteryType.CHECKIN_BASED,
      status: LotteryStatus.OPEN,
      requireCheckin: true,
      prizes: DEFAULT_PRIZES.slice(0, 1),
      winnerCount: 1,
    },
  });

  await prisma.lottery.upsert({
    where: { id: E.lotteryActivity },
    update: { requirePollId: E.pollSingle },
    create: {
      id: E.lotteryActivity,
      eventId,
      createdById: creatorId,
      title: "【参与抽奖】完成逛展投票后可抽",
      type: LotteryType.ACTIVITY_BASED,
      status: LotteryStatus.OPEN,
      requirePollId: E.pollSingle,
      prizes: DEFAULT_PRIZES.slice(0, 1),
      winnerCount: 1,
    },
  });

  await prisma.lottery.upsert({
    where: { id: E.lotteryQuiz },
    update: { quizPollId: E.pollQuiz },
    create: {
      id: E.lotteryQuiz,
      eventId,
      createdById: creatorId,
      title: "【答题抽奖】答对展会知识题参与",
      type: LotteryType.QUIZ_BASED,
      status: LotteryStatus.OPEN,
      quizPollId: E.pollQuiz,
      prizes: DEFAULT_PRIZES.slice(0, 1),
      winnerCount: 1,
    },
  });

  await seedLotteryEntries(E.lotteryOpen, ctx.endUserIds, "seed-int-entry-expo-open", 5);
  await seedLotteryEntries(E.lotteryCheckin, ctx.endUserIds, "seed-int-entry-expo-checkin", 4);
  await seedLotteryEntries(E.lotteryActivity, ctx.endUserIds, "seed-int-entry-expo-activity", 4);
  await seedLotteryEntries(E.lotteryQuiz, ctx.endUserIds, "seed-int-entry-expo-quiz", 4);

  await upsertSession({
    id: E.sessionPoll,
    eventId,
    createdById: creatorId,
    name: "逛展目的投票",
    sessionCode: E.sessionCode,
    interactions: [{ type: "poll", id: E.pollSingle }],
    scanCount: 55,
    participantCount: participants.length,
  });

  await upsertSession({
    id: E.sessionLottery,
    eventId,
    createdById: creatorId,
    name: "逛展幸运抽奖",
    sessionCode: E.sessionCodeLottery,
    interactions: [{ type: "lottery", id: E.lotteryOpen }],
    scanCount: 38,
    participantCount: 5,
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

    await upsertPoll({
      id: "seed-int-expo-booth-rating",
      eventId,
      createdById: ctx.unifiedAdminId,
      type: PollType.RATING,
      title: "【ConnectIQ 展台】产品演示满意度",
      status: PollStatus.LIVE,
    });

    await prisma.lottery.upsert({
      where: { id: "seed-int-expo-booth-lottery" },
      update: {},
      create: {
        id: "seed-int-expo-booth-lottery",
        eventId,
        createdById: ctx.unifiedAdminId,
        boothId: ctx.unifiedBoothC18Id,
        title: "【C-18 展台】现场幸运抽奖",
        type: LotteryType.RANDOM,
        status: LotteryStatus.OPEN,
        prizes: [{ rank: 1, name: "一等奖", prize: "ConnectIQ 周边礼包", count: 3 }],
        winnerCount: 1,
        entryCount: 2,
      },
    });

    await seedLotteryEntries(
      "seed-int-expo-booth-lottery",
      ctx.endUserIds,
      "seed-int-entry-expo-booth",
      4,
    );

    await seedRatingResponses(
      "seed-int-expo-booth-rating",
      participants.slice(0, 4),
      "seed-int-res-expo-booth-rating",
    );

    await seedQnaResponses(
      "seed-int-expo-booth-poll",
      participants.slice(0, 4),
      "seed-int-res-expo-booth-qna",
      [
        "ConnectIQ 支持哪些 CRM 对接？",
        "小程序端互动有哪些类型？",
        "如何导出线索数据？",
        "是否支持私有化部署？",
      ],
    );

    await upsertSession({
      id: "seed-int-expo-booth-session",
      eventId,
      createdById: ctx.unifiedAdminId,
      name: "C-18 ConnectIQ 展台互动",
      sessionCode: "SEEDC18",
      interactions: [
        { type: "poll", id: "seed-int-expo-booth-poll" },
        { type: "lottery", id: "seed-int-expo-booth-lottery" },
      ],
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
  const participants =
    ctx.summitParticipantIds?.length
      ? ctx.summitParticipantIds
      : ctx.hostedParticipantIds;

  await setEventFeatureFlags(eventId, {
    speedNetworking: true,
    inviteSystem: true,
  });

  await upsertPoll({
    id: S.pollSingle,
    eventId,
    createdById: creatorId,
    type: PollType.SINGLE_CHOICE,
    title: "【峰会投票】哪个主题演讲最有收获？",
    status: PollStatus.LIVE,
    displayOrder: 1,
    options: [
      { id: S.pollSingleO1, text: "增长方法论", displayOrder: 1 },
      { id: S.pollSingleO2, text: "AI 赋能销售", displayOrder: 2 },
    ],
  });

  await upsertPoll({
    id: S.pollMulti,
    eventId,
    createdById: creatorId,
    type: PollType.MULTI_CHOICE,
    title: "【多选】您希望下届峰会增加哪些议题？",
    status: PollStatus.LIVE,
    displayOrder: 2,
    options: [
      { id: S.pollMultiO1, text: "PLG 实践案例", displayOrder: 1 },
      { id: S.pollMultiO2, text: "出海增长策略", displayOrder: 2 },
    ],
  });

  await upsertPoll({
    id: S.pollWordCloud,
    eventId,
    createdById: creatorId,
    type: PollType.WORD_CLOUD,
    title: "【词云】用一个词形容今天的峰会",
    status: PollStatus.LIVE,
    displayOrder: 3,
  });

  await upsertPoll({
    id: S.pollRating,
    eventId,
    createdById: creatorId,
    type: PollType.RATING,
    title: "【评分】主论坛整体满意度",
    status: PollStatus.LIVE,
    displayOrder: 4,
  });

  await upsertPoll({
    id: S.pollQna,
    eventId,
    createdById: creatorId,
    type: PollType.QNA,
    title: "【峰会问答】向嘉宾提问",
    status: PollStatus.LIVE,
    displayOrder: 5,
  });

  await upsertPoll({
    id: S.pollAnnouncement,
    eventId,
    createdById: creatorId,
    type: PollType.ANNOUNCEMENT,
    title: "【公告】下午 15:30 开始 Speed Networking 环节",
    status: PollStatus.LIVE,
    displayOrder: 6,
  });

  await upsertPoll({
    id: S.pollQuiz,
    eventId,
    createdById: creatorId,
    type: PollType.SINGLE_CHOICE,
    title: "【答题】B2B SaaS 最常见的增长模型是？",
    status: PollStatus.LIVE,
    displayOrder: 7,
    options: [
      { id: S.pollQuizO1, text: "PLG", displayOrder: 1 },
      { id: S.pollQuizO2, text: "仅 SLG", displayOrder: 2 },
    ],
  });

  const qnaIds = [
    "seed-int-res-summit-qna-1",
    "seed-int-res-summit-qna-2",
    "seed-int-res-summit-qna-3",
    "seed-int-res-summit-qna-4",
    "seed-int-res-summit-qna-5",
  ];
  const qnaTexts = [
    "如何衡量 PLG 与 SLG 的 ROI？",
    "如何衡量 PLG 与 SLG 的 ROI？",
    "中小企业如何搭建客户成功团队？",
    "AI 销售助手如何与 CRM 集成？",
    "出海 SaaS 的本地化策略有哪些？",
  ];

  for (const [i, qid] of qnaIds.entries()) {
    await prisma.pollResponse.upsert({
      where: { id: qid },
      update: { textAnswer: qnaTexts[i] },
      create: {
        id: qid,
        pollId: S.pollQna,
        participantId: participants[i % participants.length],
        textAnswer: qnaTexts[i],
        isOnScreen: i === 0,
      },
    });
  }

  await setQnaDisplayConfig(eventId, S.pollQna, {
    pinnedResponseIds: ["seed-int-res-summit-qna-4"],
    answeredResponseIds: ["seed-int-res-summit-qna-3"],
    featuredResponseId: "seed-int-res-summit-qna-1",
  });

  for (let i = 0; i < Math.min(participants.length, 6); i++) {
    const pid = participants[i]!;
    await prisma.pollResponse.upsert({
      where: { id: `seed-int-res-summit-single-${i}` },
      update: {},
      create: {
        id: `seed-int-res-summit-single-${i}`,
        pollId: S.pollSingle,
        participantId: pid,
        optionId: i % 2 === 0 ? S.pollSingleO1 : S.pollSingleO2,
      },
    });
    await prisma.pollResponse.upsert({
      where: { id: `seed-int-res-summit-rating-${i}` },
      update: {},
      create: {
        id: `seed-int-res-summit-rating-${i}`,
        pollId: S.pollRating,
        participantId: pid,
        rating: (i % 5) + 1,
      },
    });
    await prisma.pollResponse.upsert({
      where: { id: `seed-int-res-summit-wc-${i}` },
      update: {},
      create: {
        id: `seed-int-res-summit-wc-${i}`,
        pollId: S.pollWordCloud,
        participantId: pid,
        textAnswer: ["干货", "连接", "增长", "专业", "惊喜", "期待"][i % 6],
      },
    });
  }

  await seedMultiChoiceResponses(
    S.pollMulti,
    [S.pollMultiO1, S.pollMultiO2],
    participants.slice(0, 6),
    "seed-int-res-summit",
  );

  await seedQuizResponses(
    S.pollQuiz,
    S.pollQuizO1,
    S.pollQuizO2,
    participants.slice(0, 5),
    "seed-int-res-summit",
  );

  await prisma.lottery.upsert({
    where: { id: S.lotteryRandom },
    update: { status: LotteryStatus.OPEN, entryCount: 4 },
    create: {
      id: S.lotteryRandom,
      eventId,
      createdById: creatorId,
      title: "【峰会抽奖】现场幸运观众",
      type: LotteryType.RANDOM,
      status: LotteryStatus.OPEN,
      prizes: DEFAULT_PRIZES.slice(0, 2),
      winnerCount: 2,
      entryCount: 4,
    },
  });

  await prisma.lottery.upsert({
    where: { id: S.lotteryQuiz },
    update: { quizPollId: S.pollQuiz },
    create: {
      id: S.lotteryQuiz,
      eventId,
      createdById: creatorId,
      title: "【答题抽奖】答对 SaaS 知识题参与",
      type: LotteryType.QUIZ_BASED,
      status: LotteryStatus.OPEN,
      quizPollId: S.pollQuiz,
      prizes: DEFAULT_PRIZES.slice(0, 1),
      winnerCount: 1,
    },
  });

  for (let i = 0; i < Math.min(ctx.endUserIds.length, 4); i++) {
    await prisma.lotteryEntry.upsert({
      where: { lotteryId_userId: { lotteryId: S.lotteryRandom, userId: ctx.endUserIds[i]! } },
      update: {},
      create: {
        id: `seed-int-entry-summit-${i}`,
        lotteryId: S.lotteryRandom,
        userId: ctx.endUserIds[i]!,
        source: LotteryEntrySource.MANUAL,
      },
    });
  }

  await seedLotteryEntries(S.lotteryQuiz, ctx.endUserIds, "seed-int-entry-summit-quiz", 5);

  await upsertSession({
    id: S.sessionQna,
    eventId,
    createdById: creatorId,
    name: "主论坛现场问答",
    sessionCode: S.sessionCodeQna,
    interactions: [{ type: "poll", id: S.pollQna }],
    scanCount: 210,
    participantCount: qnaIds.length,
  });

  await upsertSession({
    id: S.sessionPoll,
    eventId,
    createdById: creatorId,
    name: "主题演讲满意度投票",
    sessionCode: S.sessionCodePoll,
    interactions: [{ type: "poll", id: S.pollSingle }],
    scanCount: 156,
    participantCount: Math.min(participants.length, 6),
  });

  await upsertSession({
    id: S.sessionLottery,
    eventId,
    createdById: creatorId,
    name: "峰会幸运抽奖",
    sessionCode: S.sessionCodeLottery,
    interactions: [{ type: "lottery", id: S.lotteryRandom }],
    scanCount: 98,
    participantCount: 4,
  });
}

async function seedInnovationSummitInteractions(ctx: SeedInteractionsContext) {
  if (!ctx.innovationSummitEventId) return;
  const I = SEED_INT.innovation;
  const eventId = ctx.innovationSummitEventId;
  const creatorId = ctx.unifiedAdminId;
  const participants = ctx.innovationParticipantIds ?? [];

  await setEventFeatureFlags(eventId, { speedNetworking: true });

  await upsertPoll({
    id: I.pollSingle,
    eventId,
    createdById: creatorId,
    type: PollType.SINGLE_CHOICE,
    title: "【会议投票】您最期待哪个议题方向？",
    status: PollStatus.LIVE,
    displayOrder: 1,
    options: [
      { id: I.pollSingleO1, text: "活动科技趋势", displayOrder: 1 },
      { id: I.pollSingleO2, text: "会议×展览融合", displayOrder: 2 },
      { id: I.pollSingleO3, text: "现场互动创新", displayOrder: 3 },
    ],
  });

  await upsertPoll({
    id: I.pollMulti,
    eventId,
    createdById: creatorId,
    type: PollType.MULTI_CHOICE,
    title: "【多选】您希望增加哪些互动形式？",
    status: PollStatus.LIVE,
    displayOrder: 2,
    options: [
      { id: I.pollMultiO1, text: "实时问答", displayOrder: 1 },
      { id: I.pollMultiO2, text: "现场抽奖", displayOrder: 2 },
    ],
  });

  await upsertPoll({
    id: I.pollWordCloud,
    eventId,
    createdById: creatorId,
    type: PollType.WORD_CLOUD,
    title: "【词云】用一个词形容 ConnectIQ",
    status: PollStatus.LIVE,
    displayOrder: 3,
  });

  await upsertPoll({
    id: I.pollRating,
    eventId,
    createdById: creatorId,
    type: PollType.RATING,
    title: "【评分】开幕 keynote 满意度",
    status: PollStatus.LIVE,
    displayOrder: 4,
  });

  await upsertPoll({
    id: I.pollQna,
    eventId,
    createdById: creatorId,
    type: PollType.QNA,
    title: "【会议问答】向主办方提问",
    status: PollStatus.LIVE,
    displayOrder: 5,
  });

  await upsertPoll({
    id: I.pollAnnouncement,
    eventId,
    createdById: creatorId,
    type: PollType.ANNOUNCEMENT,
    title: "【公告】下午将进行 Speed Networking 预配对",
    status: PollStatus.LIVE,
    displayOrder: 6,
  });

  await upsertPoll({
    id: I.pollQuiz,
    eventId,
    createdById: creatorId,
    type: PollType.SINGLE_CHOICE,
    title: "【答题】活动运营中最常用的互动形式是？",
    status: PollStatus.LIVE,
    displayOrder: 7,
    options: [
      { id: I.pollQuizO1, text: "现场投票 + 问答", displayOrder: 1 },
      { id: I.pollQuizO2, text: "仅静态 PPT", displayOrder: 2 },
    ],
  });

  await upsertPoll({
    id: I.pollSurvey,
    eventId,
    createdById: creatorId,
    type: PollType.MULTI_CHOICE,
    title: "【问卷】您最希望 ConnectIQ 优先上线哪些能力？",
    status: PollStatus.LIVE,
    displayOrder: 8,
    options: [
      { id: I.pollSurveyO1, text: "AI 智能配对", displayOrder: 1 },
      { id: I.pollSurveyO2, text: "多活动统一管理", displayOrder: 2 },
      { id: I.pollSurveyO3, text: "数据大屏", displayOrder: 3 },
    ],
  });

  for (let i = 0; i < participants.length; i++) {
    const pid = participants[i]!;
    await prisma.pollResponse.upsert({
      where: { id: `seed-int-res-innovation-single-${i}` },
      update: {},
      create: {
        id: `seed-int-res-innovation-single-${i}`,
        pollId: I.pollSingle,
        participantId: pid,
        optionId: [I.pollSingleO1, I.pollSingleO2, I.pollSingleO3][i % 3],
      },
    });
    await prisma.pollResponse.upsert({
      where: { id: `seed-int-res-innovation-rating-${i}` },
      update: {},
      create: {
        id: `seed-int-res-innovation-rating-${i}`,
        pollId: I.pollRating,
        participantId: pid,
        rating: (i % 5) + 1,
      },
    });
  }

  await seedMultiChoiceResponses(
    I.pollMulti,
    [I.pollMultiO1, I.pollMultiO2],
    participants,
    "seed-int-res-innovation",
  );

  await seedWordCloudResponses(I.pollWordCloud, participants, "seed-int-res-innovation");

  await seedQuizResponses(
    I.pollQuiz,
    I.pollQuizO1,
    I.pollQuizO2,
    participants,
    "seed-int-res-innovation",
  );

  await seedMultiChoiceResponses(
    I.pollSurvey,
    [I.pollSurveyO1, I.pollSurveyO2, I.pollSurveyO3],
    participants,
    "seed-int-res-innovation-survey",
  );

  const innovationQna = [
    { id: "seed-int-res-innovation-qna-1", text: "ConnectIQ 是否支持私有化部署？", idx: 0 },
    { id: "seed-int-res-innovation-qna-2", text: "如何与现有 CRM 对接？", idx: 1 },
    { id: "seed-int-res-innovation-qna-3", text: "小程序端有哪些互动能力？", idx: 2 },
  ];
  for (const q of innovationQna) {
    await prisma.pollResponse.upsert({
      where: { id: q.id },
      update: { textAnswer: q.text },
      create: {
        id: q.id,
        pollId: I.pollQna,
        participantId: participants[q.idx] ?? participants[0],
        textAnswer: q.text,
        isOnScreen: q.id.endsWith("qna-1"),
      },
    });
  }

  await prisma.lottery.upsert({
    where: { id: I.lotteryRandom },
    update: { status: LotteryStatus.OPEN },
    create: {
      id: I.lotteryRandom,
      eventId,
      createdById: creatorId,
      title: "【会议抽奖】开幕幸运奖",
      type: LotteryType.RANDOM,
      status: LotteryStatus.OPEN,
      prizes: DEFAULT_PRIZES.slice(0, 2),
      winnerCount: 2,
    },
  });

  await prisma.lottery.upsert({
    where: { id: I.lotteryActivity },
    update: { requirePollId: I.pollSingle },
    create: {
      id: I.lotteryActivity,
      eventId,
      createdById: creatorId,
      title: "【参与抽奖】完成投票后可参与",
      type: LotteryType.ACTIVITY_BASED,
      status: LotteryStatus.OPEN,
      requirePollId: I.pollSingle,
      prizes: DEFAULT_PRIZES.slice(0, 1),
      winnerCount: 1,
    },
  });

  await prisma.lottery.upsert({
    where: { id: I.lotteryQuiz },
    update: { quizPollId: I.pollQuiz },
    create: {
      id: I.lotteryQuiz,
      eventId,
      createdById: creatorId,
      title: "【答题抽奖】答对运营知识题参与",
      type: LotteryType.QUIZ_BASED,
      status: LotteryStatus.OPEN,
      quizPollId: I.pollQuiz,
      prizes: DEFAULT_PRIZES.slice(0, 1),
      winnerCount: 1,
    },
  });

  await seedLotteryEntries(I.lotteryRandom, ctx.endUserIds, "seed-int-entry-innovation-random", 5);
  await seedLotteryEntries(I.lotteryActivity, ctx.endUserIds, "seed-int-entry-innovation-activity", 4);
  await seedLotteryEntries(I.lotteryQuiz, ctx.endUserIds, "seed-int-entry-innovation-quiz", 4);

  await upsertSession({
    id: I.sessionPoll,
    eventId,
    createdById: creatorId,
    name: "议题方向投票",
    sessionCode: I.sessionCodePoll,
    interactions: [{ type: "poll", id: I.pollSingle }],
    scanCount: 67,
    participantCount: participants.length,
  });

  await upsertSession({
    id: I.sessionQna,
    eventId,
    createdById: creatorId,
    name: "现场问答",
    sessionCode: I.sessionCodeQna,
    interactions: [{ type: "poll", id: I.pollQna }],
    scanCount: 45,
    participantCount: innovationQna.length,
  });

  await upsertSession({
    id: I.sessionLottery,
    eventId,
    createdById: creatorId,
    name: "开幕幸运抽奖",
    sessionCode: I.sessionCodeLottery,
    interactions: [{ type: "lottery", id: I.lotteryRandom }],
    scanCount: 52,
    participantCount: 3,
  });
}

async function seedSalonInteractions(ctx: SeedInteractionsContext) {
  if (!ctx.salonEventId) return;
  const L = SEED_INT.salon;
  const eventId = ctx.salonEventId;
  const creatorId = ctx.confAdminId;
  const participants = ctx.salonParticipantIds ?? [];

  await setEventFeatureFlags(eventId);

  await upsertPoll({
    id: L.pollSingle,
    eventId,
    createdById: creatorId,
    type: PollType.SINGLE_CHOICE,
    title: "【沙龙投票】本次分享最有价值的部分？",
    status: PollStatus.LIVE,
    options: [
      { id: L.pollSingleO1, text: "增长实验框架", displayOrder: 1 },
      { id: L.pollSingleO2, text: "案例拆解", displayOrder: 2 },
    ],
  });

  await upsertPoll({
    id: L.pollMulti,
    eventId,
    createdById: creatorId,
    type: PollType.MULTI_CHOICE,
    title: "【多选】您希望下次沙龙深入哪些话题？",
    status: PollStatus.LIVE,
    options: [
      { id: L.pollMultiO1, text: "A/B 测试", displayOrder: 1 },
      { id: L.pollMultiO2, text: "留存优化", displayOrder: 2 },
      { id: L.pollMultiO3, text: "渠道归因", displayOrder: 3 },
    ],
  });

  await upsertPoll({
    id: L.pollWordCloud,
    eventId,
    createdById: creatorId,
    type: PollType.WORD_CLOUD,
    title: "【词云】用一个词形容今天的沙龙",
    status: PollStatus.LIVE,
  });

  await upsertPoll({
    id: L.pollSurvey,
    eventId,
    createdById: creatorId,
    type: PollType.MULTI_CHOICE,
    title: "【问卷】您对沙龙形式的偏好？",
    status: PollStatus.LIVE,
    options: [
      { id: L.pollSurveyO1, text: "案例拆解为主", displayOrder: 1 },
      { id: L.pollSurveyO2, text: "互动讨论为主", displayOrder: 2 },
      { id: L.pollSurveyO3, text: "嘉宾 Q&A 为主", displayOrder: 3 },
    ],
  });

  await upsertPoll({
    id: L.pollQna,
    eventId,
    createdById: creatorId,
    type: PollType.QNA,
    title: "【沙龙问答】向分享嘉宾提问",
    status: PollStatus.LIVE,
  });

  await upsertPoll({
    id: L.pollRating,
    eventId,
    createdById: creatorId,
    type: PollType.RATING,
    title: "【评分】沙龙整体满意度",
    status: PollStatus.LIVE,
  });

  await seedPollSubmissionPack({
    prefix: "seed-int-res-salon",
    participantIds: participants,
    single: { pollId: L.pollSingle, optionIds: [L.pollSingleO1, L.pollSingleO2] },
    multi: { pollId: L.pollMulti, optionIds: [L.pollMultiO1, L.pollMultiO2, L.pollMultiO3] },
    wordCloud: { pollId: L.pollWordCloud },
    rating: { pollId: L.pollRating },
    qna: {
      pollId: L.pollQna,
      questions: [
        "如何在小团队快速验证增长假设？",
        "冷启动阶段如何获取第一批用户？",
        "B2B 产品如何做 PLG？",
        "留存指标应该看哪些维度？",
      ],
    },
  });

  await seedMultiChoiceResponses(
    L.pollSurvey,
    [L.pollSurveyO1, L.pollSurveyO2, L.pollSurveyO3],
    participants,
    "seed-int-res-salon-survey",
  );

  await prisma.lottery.upsert({
    where: { id: L.lotteryOpen },
    update: {},
    create: {
      id: L.lotteryOpen,
      eventId,
      createdById: creatorId,
      title: "【沙龙抽奖】到场幸运观众",
      type: LotteryType.RANDOM,
      status: LotteryStatus.OPEN,
      prizes: [{ rank: 1, name: "一等奖", prize: "增长方法论手册", count: 1 }],
      winnerCount: 1,
    },
  });

  await seedLotteryEntries(L.lotteryOpen, ctx.endUserIds, "seed-int-entry-salon", 4);

  await upsertSession({
    id: L.sessionPoll,
    eventId,
    createdById: creatorId,
    name: "沙龙现场投票",
    sessionCode: L.sessionCode,
    interactions: [{ type: "poll", id: L.pollSingle }],
    scanCount: 28,
    participantCount: participants.length,
  });

  await upsertSession({
    id: L.sessionQna,
    eventId,
    createdById: creatorId,
    name: "沙龙现场问答",
    sessionCode: L.sessionCodeQna,
    interactions: [{ type: "poll", id: L.pollQna }],
    scanCount: 19,
    participantCount: Math.min(participants.length, 4),
  });
}

export async function seedInteractionDemoData(ctx: SeedInteractionsContext) {
  await clearSeedInteractionData();
  await seedHostedExpoInteractions(ctx);
  await seedExpoInteractions(ctx);
  await seedSummitInteractions(ctx);
  await seedInnovationSummitInteractions(ctx);
  await seedSalonInteractions(ctx);

  return {
    sessionCodes: {
      hostedPoll: SEED_INT.hostedExpo.sessionCodePoll,
      hostedLottery: SEED_INT.hostedExpo.sessionCodeLottery,
      hostedBooth: SEED_INT.hostedExpo.sessionCodeBooth,
      expo: SEED_INT.expo.sessionCode,
      summitQna: SEED_INT.summit.sessionCodeQna,
      summitPoll: SEED_INT.summit.sessionCodePoll,
      summitLottery: SEED_INT.summit.sessionCodeLottery,
      innovationPoll: SEED_INT.innovation.sessionCodePoll,
      innovationQna: SEED_INT.innovation.sessionCodeQna,
      innovationLottery: SEED_INT.innovation.sessionCodeLottery,
      salon: SEED_INT.salon.sessionCode,
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
  console.log(`  峰会问答:         ${result.sessionCodes.summitQna}`);
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
