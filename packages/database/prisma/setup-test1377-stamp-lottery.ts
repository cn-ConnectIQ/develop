/**
 * 为 TEST1377 配置「集章打卡 → 抽奖」联调任务
 * 用法：pnpm --filter @connectiq/database db:setup-test1377-stamp-lottery
 */
import {
  BoothStatus,
  EventStatus,
  InteractionOwnerType,
  LotteryStatus,
  LotteryType,
  ReviewStatus,
  StampRallyStatus,
} from "@prisma/client";
import { prisma } from "../src/client";
import {
  MOBILE_TEST_JOIN_CODE,
  MOBILE_TEST_PRODUCTION_EVENT_ID,
} from "./seed-mobile-test-dimensions";

const PREFIX = "seed-m1377";
const LOTTERY_ID = `${PREFIX}-lottery-live`;
const SESSION_ID = `${PREFIX}-session-lottery`;
const RALLY_ID = `${PREFIX}-stamp-rally-${MOBILE_TEST_PRODUCTION_EVENT_ID.slice(-8)}`;
const STAMP_BOOTH_CODES = ["A-101", "A-102", "T1377-Q"] as const;
const REQUIRED_STAMPS = 3;

const LOTTERY_PRIZES = [
  { rank: 1, name: "一等奖", prize: "MacBook Air", count: 1 },
  { rank: 2, name: "二等奖", prize: "iPad", count: 2 },
  { rank: 3, name: "三等奖", prize: "ConnectIQ 限定礼盒", count: 5 },
];

function daysAgo(days: number, hours = 0) {
  return new Date(Date.now() - days * 86_400_000 - hours * 3_600_000);
}

function daysFromNow(days: number, hours = 18) {
  return new Date(Date.now() + days * 86_400_000 + hours * 3_600_000);
}

async function main() {
  const event = await prisma.event.findUnique({
    where: { id: MOBILE_TEST_PRODUCTION_EVENT_ID },
    select: { id: true, name: true, organizerId: true, featureFlags: true },
  });
  if (!event) {
    throw new Error(`活动不存在: ${MOBILE_TEST_PRODUCTION_EVENT_ID}`);
  }

  const flags =
    event.featureFlags && typeof event.featureFlags === "object"
      ? (event.featureFlags as Record<string, boolean>)
      : {};

  await prisma.event.update({
    where: { id: event.id },
    data: {
      status: EventStatus.LIVE,
      reviewStatus: ReviewStatus.LIVE,
      startDate: daysAgo(1),
      endDate: daysFromNow(3),
      featureFlags: {
        ...flags,
        stampRally: true,
        lottery: true,
        aiBoothRoute: true,
      },
    },
  });

  let booths = await prisma.exhibitorBooth.findMany({
    where: { eventId: event.id, code: { in: [...STAMP_BOOTH_CODES] } },
    orderBy: { code: "asc" },
    select: { id: true, code: true, name: true },
  });

  if (booths.length < REQUIRED_STAMPS) {
    booths = await prisma.exhibitorBooth.findMany({
      where: { eventId: event.id },
      orderBy: { code: "asc" },
      take: REQUIRED_STAMPS,
      select: { id: true, code: true, name: true },
    });
  }

  if (booths.length === 0) {
    throw new Error("活动下无展位，请先 seed 展位数据");
  }

  const boothIds = booths.map((b) => b.id);

  const rally = await prisma.stampRally.upsert({
    where: { id: RALLY_ID },
    update: {
      status: StampRallyStatus.ACTIVE,
      name: "TEST1377 逛展集章挑战",
      description: "打卡指定展位集满印章，兑奖后自动获得现场抽奖资格",
      prize: "限定礼品 + 【TEST1377】现场幸运大抽奖资格",
      requiredCount: Math.min(REQUIRED_STAMPS, boothIds.length),
      totalBooths: boothIds.length,
      boothIds,
      startsAt: daysAgo(0, 0),
      endsAt: daysFromNow(3),
    },
    create: {
      id: RALLY_ID,
      eventId: event.id,
      createdById: event.organizerId,
      name: "TEST1377 逛展集章挑战",
      description: "打卡指定展位集满印章，兑奖后自动获得现场抽奖资格",
      prize: "限定礼品 + 【TEST1377】现场幸运大抽奖资格",
      requiredCount: Math.min(REQUIRED_STAMPS, boothIds.length),
      totalBooths: boothIds.length,
      boothIds,
      status: StampRallyStatus.ACTIVE,
      startsAt: daysAgo(0, 0),
      endsAt: daysFromNow(3),
    },
  });

  const lottery = await prisma.lottery.upsert({
    where: { id: LOTTERY_ID },
    update: {
      status: LotteryStatus.OPEN,
      title: "【TEST1377】现场幸运大抽奖",
      description: "完成集章兑奖后自动获得参与资格，也可扫码 T1377L 进入",
      prizes: LOTTERY_PRIZES,
      winnerCount: 3,
    },
    create: {
      id: LOTTERY_ID,
      eventId: event.id,
      createdById: event.organizerId,
      title: "【TEST1377】现场幸运大抽奖",
      description: "完成集章兑奖后自动获得参与资格，也可扫码 T1377L 进入",
      type: LotteryType.RANDOM,
      status: LotteryStatus.OPEN,
      prizes: LOTTERY_PRIZES,
      winnerCount: 3,
    },
  });

  await prisma.interactionSession.upsert({
    where: { id: SESSION_ID },
    update: {
      isActive: true,
      sessionCode: "T1377L",
      interactions: [{ type: "lottery", id: lottery.id }],
    },
    create: {
      id: SESSION_ID,
      eventId: event.id,
      createdById: event.organizerId,
      name: "TEST1377 现场抽奖",
      sessionCode: "T1377L",
      interactions: [{ type: "lottery", id: lottery.id }],
      ownerType: InteractionOwnerType.ORGANIZER,
      isActive: true,
    },
  });

  await prisma.eventSetting.upsert({
    where: {
      eventId_key: { eventId: event.id, key: "stamp_rally_lottery_id" },
    },
    create: {
      eventId: event.id,
      key: "stamp_rally_lottery_id",
      value: { lottery_id: lottery.id },
    },
    update: {
      value: { lottery_id: lottery.id },
    },
  });

  await prisma.eventSetting.upsert({
    where: { eventId_key: { eventId: event.id, key: "join_code" } },
    create: {
      eventId: event.id,
      key: "join_code",
      value: { code: MOBILE_TEST_JOIN_CODE },
    },
    update: { value: { code: MOBILE_TEST_JOIN_CODE } },
  });

  console.log("✓ TEST1377 集章→抽奖任务已配置");
  console.log(
    JSON.stringify(
      {
        event: { id: event.id, name: event.name, join_code: MOBILE_TEST_JOIN_CODE },
        stamp_rally: {
          id: rally.id,
          name: rally.name,
          required_count: rally.requiredCount,
          booths: booths.map((b) => ({ code: b.code, name: b.name })),
        },
        lottery: {
          id: lottery.id,
          title: lottery.title,
          scan_code: "T1377L",
          status: lottery.status,
        },
        flow: [
          "1. 小程序 → 找展位 → 扫 A-101 / A-102 / T1377-Q 集章",
          "2. 集满 3 章 → 弹出兑奖 → 自动报名抽奖",
          "3. 活动主页快捷入口「抽奖」或扫码 T1377L 参与",
        ],
      },
      null,
      2,
    ),
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
