/**
 * TEST1377 三项现场互动：有奖投票 / 集章打卡 / 展位打卡抽奖
 */
import {
  EventStatus,
  LotteryStatus,
  LotteryType,
  PollStatus,
  PollType,
  ReviewStatus,
} from "@prisma/client";
import { prisma } from "../src/client";
import { MOBILE_TEST_PRODUCTION_EVENT_ID } from "./seed-mobile-test-dimensions";

const PREFIX = "seed-m1377";
const PRIZE_POLL_ID = `${PREFIX}-poll-prize`;
const BOOTH_LOTTERY_ID = `${PREFIX}-booth-lottery-q`;
const BOOTH_CODE = "T1377-Q";

const BOOTH_LOTTERY_PRIZES = [
  { rank: 1, name: "特等奖", prize: "ConnectIQ 限定礼盒", count: 3 },
  { rank: 2, name: "参与奖", prize: "展会周边一份", count: 20 },
];

async function main() {
  const event = await prisma.event.findUnique({
    where: { id: MOBILE_TEST_PRODUCTION_EVENT_ID },
    select: { id: true, name: true, organizerId: true, featureFlags: true },
  });
  if (!event) throw new Error("TEST1377 活动不存在");

  const flags =
    event.featureFlags && typeof event.featureFlags === "object"
      ? (event.featureFlags as Record<string, boolean>)
      : {};

  await prisma.event.update({
    where: { id: event.id },
    data: {
      status: EventStatus.LIVE,
      reviewStatus: ReviewStatus.LIVE,
      featureFlags: { ...flags, stampRally: true, lottery: true },
    },
  });

  const closesAt = new Date(Date.now() + 4 * 3_600_000);
  const poll = await prisma.poll.upsert({
    where: { id: PRIZE_POLL_ID },
    update: {
      status: PollStatus.LIVE,
      title: "【有奖投票】您最看好哪个展区？",
      closesAt,
      showResults: true,
    },
    create: {
      id: PRIZE_POLL_ID,
      eventId: event.id,
      createdById: event.organizerId,
      type: PollType.SINGLE_CHOICE,
      title: "【有奖投票】您最看好哪个展区？",
      status: PollStatus.LIVE,
      closesAt,
      showResults: true,
      displayOrder: 1,
      options: {
        create: [
          { text: "智能制造", displayOrder: 0 },
          { text: "企业服务 / SaaS", displayOrder: 1 },
          { text: "MarTech 营销科技", displayOrder: 2 },
        ],
      },
    },
    include: { options: true },
  });

  const booth = await prisma.exhibitorBooth.findFirst({
    where: { eventId: event.id, code: BOOTH_CODE },
    select: { id: true, code: true, name: true },
  });
  if (!booth) {
    throw new Error(`未找到展位 ${BOOTH_CODE}，请先执行 mobile-test seed`);
  }

  const boothLottery = await prisma.lottery.upsert({
    where: { id: BOOTH_LOTTERY_ID },
    update: {
      status: LotteryStatus.OPEN,
      boothId: booth.id,
      title: `【${BOOTH_CODE}】展位打卡抽奖`,
      prizes: BOOTH_LOTTERY_PRIZES,
    },
    create: {
      id: BOOTH_LOTTERY_ID,
      eventId: event.id,
      createdById: event.organizerId,
      boothId: booth.id,
      title: `【${BOOTH_CODE}】展位打卡抽奖`,
      description: "到场扫码展位并打卡，即可参与即时抽奖",
      type: LotteryType.RANDOM,
      status: LotteryStatus.OPEN,
      prizes: BOOTH_LOTTERY_PRIZES,
      winnerCount: 3,
    },
  });

  console.log("✓ TEST1377 三项现场互动已就绪");
  console.log(
    JSON.stringify(
      {
        event_id: event.id,
        live_interactions: [
          {
            label: "有奖投票",
            type: "POLL",
            id: poll.id,
            title: poll.title,
            closes_at: closesAt.toISOString(),
          },
          {
            label: "集章打卡",
            type: "STAMP",
            hint: "执行 db:setup-test1377-stamp-lottery 配置集章路线",
          },
          {
            label: "展位打卡抽奖",
            type: "LOTTERY",
            id: boothLottery.id,
            booth_code: booth.code,
            booth_name: booth.name,
            title: boothLottery.title,
          },
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
