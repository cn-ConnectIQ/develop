/**
 * 13770626459 全维度测试数据（依赖完整 seed 后的演示实体）
 */
import {
  ConnectionSource,
  ConnectionStatus,
  ExchangeStatus,
  FeedItemType,
  LotteryEntrySource,
  MeetingStatus,
  PointsReason,
  ReferralStatus,
  SignalType,
  UserAccountStatus,
} from "@prisma/client";
import { prisma } from "../src/client";

/** 与 seed-mobile-test-attendee 保持一致 */
const MOBILE_TEST_PHONE = "13770626459";
const MOBILE_TEST_NAME = "钱测试";

/** 专用测试活动码 → 智链未来产业博览会 2026（LIVE，功能最全） */
export const MOBILE_TEST_JOIN_CODE = "TEST1377";
export const MOBILE_TEST_PRIMARY_EVENT_SLUG = "smart-link-industry-expo-2026";

const PREFIX = "seed-m1377";

const SEED_INT_HOSTED = {
  lotteryRandom: "seed-int-hosted-lottery-random",
  pollSingle: "seed-int-hosted-poll-single",
  pollSingleOpt1: "seed-int-hosted-poll-single-o1",
  stampRally: "seed-feat-stamp-hosted-expo",
} as const;

const SEED_MTG_TABLE = "seed-mtg-table-hosted-a-01";

function daysAgo(days: number, hours = 10) {
  return new Date(Date.now() - days * 86_400_000 - hours * 3_600_000);
}

function slotToday(hour: number, minute: number, durationMinutes = 20) {
  const start = new Date();
  start.setHours(hour, minute, 0, 0);
  const end = new Date(start.getTime() + durationMinutes * 60_000);
  return { start, end };
}

async function findPeer(phone: string) {
  return prisma.user.findFirst({
    where: { phone },
    select: {
      id: true,
      name: true,
      profile: { select: { company: true, valueProposition: true } },
    },
  });
}

export type MobileTestDimensionsResult = {
  userId: string;
  eventId: string;
  eventName: string;
  joinCode: string;
  dimensions: string[];
};

export async function seedMobileTestAttendeeDimensions(
  userId?: string,
): Promise<MobileTestDimensionsResult> {
  const user =
    userId != null
      ? await prisma.user.findUnique({
          where: { id: userId },
          select: { id: true, name: true },
        })
      : await prisma.user.findFirst({
          where: { phone: MOBILE_TEST_PHONE },
          select: { id: true, name: true },
        });

  if (!user) {
    throw new Error(`未找到测试用户 ${MOBILE_TEST_PHONE}，请先执行 seedMobileTestAttendee`);
  }

  const event = await prisma.event.findUnique({
    where: { slug: MOBILE_TEST_PRIMARY_EVENT_SLUG },
    select: { id: true, name: true, startDate: true },
  });
  if (!event) {
    throw new Error(`缺少主测试活动 ${MOBILE_TEST_PRIMARY_EVENT_SLUG}`);
  }

  const dimensions: string[] = [];

  await prisma.eventSetting.upsert({
    where: { eventId_key: { eventId: event.id, key: "join_code" } },
    create: { eventId: event.id, key: "join_code", value: { code: MOBILE_TEST_JOIN_CODE } },
    update: { value: { code: MOBILE_TEST_JOIN_CODE } },
  });
  dimensions.push("活动码");

  const participantId = `seed-part-mobile-test-${MOBILE_TEST_PRIMARY_EVENT_SLUG.replace(/-/g, "_")}`;
  const booths = await prisma.exhibitorBooth.findMany({
    where: { eventId: event.id, code: { in: ["A-101", "A-102", "A-103"] } },
    orderBy: { code: "asc" },
    select: { id: true, code: true },
  });

  const [peerA, peerB, peerC] = await Promise.all([
    findPeer("13900000001"),
    findPeer("13900000002"),
    findPeer("13900000003"),
  ]);

  if (peerA) {
    await prisma.businessConnection.upsert({
      where: { id: `${PREFIX}-conn-active` },
      update: { status: ConnectionStatus.ACTIVE, wechatExchanged: true },
      create: {
        id: `${PREFIX}-conn-active`,
        userAId: user.id,
        userBId: peerA.id,
        userAName: MOBILE_TEST_NAME,
        userACompany: "ConnectIQ 测试",
        userBName: peerA.name,
        userBCompany: peerA.profile?.company ?? undefined,
        source: ConnectionSource.SCAN,
        eventId: event.id,
        eventName: event.name,
        aiScore: 86,
        wechatExchanged: true,
        wechatExchangedAt: daysAgo(0, 3),
        fromAiMatch: true,
        aiMatchScore: 86,
      },
    });
    dimensions.push("商务连接(已交换微信)");
  }

  if (peerB) {
    await prisma.exchangeRequest.upsert({
      where: {
        fromUserId_toUserId_eventId: {
          fromUserId: peerB.id,
          toUserId: user.id,
          eventId: event.id,
        },
      },
      update: { status: ExchangeStatus.PENDING, message: "现场认识了一下，方便交换微信吗？" },
      create: {
        id: `${PREFIX}-exchange-in`,
        fromUserId: peerB.id,
        toUserId: user.id,
        eventId: event.id,
        status: ExchangeStatus.PENDING,
        message: "现场认识了一下，方便交换微信吗？",
      },
    });
    dimensions.push("待处理交换请求(收到)");
  }

  if (peerC) {
    await prisma.exchangeRequest.upsert({
      where: {
        fromUserId_toUserId_eventId: {
          fromUserId: user.id,
          toUserId: peerC.id,
          eventId: event.id,
        },
      },
      update: { status: ExchangeStatus.ACCEPTED, message: "想聊聊 CRM 集成合作" },
      create: {
        id: `${PREFIX}-exchange-out`,
        fromUserId: user.id,
        toUserId: peerC.id,
        eventId: event.id,
        status: ExchangeStatus.ACCEPTED,
        message: "想聊聊 CRM 集成合作",
        respondedAt: daysAgo(0, 2),
      },
    });
    dimensions.push("已接受交换请求(发出)");
  }

  const table = await prisma.meetingTable.findUnique({ where: { id: SEED_MTG_TABLE } });
  if (peerA && table) {
    const slot = slotToday(14, 30);
    await prisma.meeting.upsert({
      where: { id: `${PREFIX}-meeting-accepted` },
      update: { status: MeetingStatus.ACCEPTED },
      create: {
        id: `${PREFIX}-meeting-accepted`,
        eventId: event.id,
        requesterId: user.id,
        recipientId: peerA.id,
        status: MeetingStatus.ACCEPTED,
        scheduledStart: slot.start,
        scheduledEnd: slot.end,
        tableId: table.id,
        message: "想深入聊聊 B2B 营销自动化",
        fromAiMatch: true,
        aiMatchScore: 82,
        respondedAt: daysAgo(0, 1),
      },
    });
    dimensions.push("1v1 会面(已接受)");
  }

  if (peerB) {
    const slot = slotToday(16, 0);
    await prisma.meeting.upsert({
      where: { id: `${PREFIX}-meeting-pending` },
      update: { status: MeetingStatus.PENDING },
      create: {
        id: `${PREFIX}-meeting-pending`,
        eventId: event.id,
        requesterId: peerB.id,
        recipientId: user.id,
        status: MeetingStatus.PENDING,
        scheduledStart: slot.start,
        scheduledEnd: slot.end,
        message: "下午有空聊聊渠道合作吗？",
      },
    });
    dimensions.push("1v1 会面(待确认)");
  }

  if (peerC) {
    await prisma.meeting.upsert({
      where: { id: `${PREFIX}-meeting-done` },
      update: { status: MeetingStatus.COMPLETED, wechatExchanged: true },
      create: {
        id: `${PREFIX}-meeting-done`,
        eventId: event.id,
        requesterId: user.id,
        recipientId: peerC.id,
        status: MeetingStatus.COMPLETED,
        scheduledStart: daysAgo(0, 5),
        scheduledEnd: daysAgo(0, 4),
        wechatExchanged: true,
        respondedAt: daysAgo(0, 5),
      },
    });
    dimensions.push("1v1 会面(已完成)");
  }

  const rally = await prisma.stampRally.findUnique({
    where: { id: SEED_INT_HOSTED.stampRally },
    select: { id: true, boothIds: true },
  });
  if (rally && booths.length > 0) {
    for (const booth of booths) {
      await prisma.stampRecord.upsert({
        where: {
          rallyId_userId_boothId: {
            rallyId: rally.id,
            userId: user.id,
            boothId: booth.id,
          },
        },
        update: {},
        create: {
          id: `${PREFIX}-stamp-${booth.code.replace(/[^a-z0-9]/gi, "")}`,
          rallyId: rally.id,
          userId: user.id,
          boothId: booth.id,
        },
      });
      await prisma.boothVisitSignal.createMany({
        data: [
          {
            userId: user.id,
            eventId: event.id,
            signalType: SignalType.BOOTH_SCAN,
            entityId: booth.id,
            entityType: "BOOTH",
            payload: { source: PREFIX, booth_code: booth.code },
          },
        ],
        skipDuplicates: true,
      });
    }
    dimensions.push(`集章护照(${booths.length} 展位)`);
  }

  const lottery = await prisma.lottery.findUnique({
    where: { id: SEED_INT_HOSTED.lotteryRandom },
    select: { id: true },
  });
  if (lottery) {
    await prisma.lotteryEntry.upsert({
      where: { lotteryId_userId: { lotteryId: lottery.id, userId: user.id } },
      update: {},
      create: {
        id: `${PREFIX}-lottery-entry`,
        lotteryId: lottery.id,
        userId: user.id,
        source: LotteryEntrySource.MANUAL,
      },
    });
    dimensions.push("抽奖参与");
  }

  const poll = await prisma.poll.findUnique({
    where: { id: SEED_INT_HOSTED.pollSingle },
    select: { id: true },
  });
  if (poll) {
    await prisma.pollResponse.upsert({
      where: { id: `${PREFIX}-poll-res` },
      update: { optionId: SEED_INT_HOSTED.pollSingleOpt1 },
      create: {
        id: `${PREFIX}-poll-res`,
        pollId: poll.id,
        participantId,
        optionId: SEED_INT_HOSTED.pollSingleOpt1,
      },
    });
    dimensions.push("现场投票");
  }

  const boothA101 = booths.find((b) => b.code === "A-101");
  if (boothA101) {
    await prisma.lead.upsert({
      where: { id: `${PREFIX}-lead` },
      update: { intentGrade: "A", notes: "移动端测试账号 · 现场扫码意向 A" },
      create: {
        id: `${PREFIX}-lead`,
        boothId: boothA101.id,
        participantId,
        intentGrade: "A",
        notes: "移动端测试账号 · 现场扫码意向 A",
      },
    });
    dimensions.push("展位线索(A 级)");
  }

  const pointsEntries = [
    { id: `${PREFIX}-pts-checkin`, amount: 100, reason: PointsReason.CHECKIN, note: "活动签到" },
    { id: `${PREFIX}-pts-conn`, amount: 200, reason: PointsReason.CONNECTION, note: "成功交换名片" },
    { id: `${PREFIX}-pts-interact`, amount: 150, reason: PointsReason.INTERACTION, note: "参与现场投票" },
    { id: `${PREFIX}-pts-profile`, amount: 80, reason: PointsReason.PROFILE, note: "完善个人资料" },
    { id: `${PREFIX}-pts-referral`, amount: 250, reason: PointsReason.REFERRAL, note: "成功引荐对接" },
  ];
  for (const row of pointsEntries) {
    await prisma.pointsLedger.upsert({
      where: { id: row.id },
      update: { amount: row.amount },
      create: { id: row.id, userId: user.id, amount: row.amount, reason: row.reason, note: row.note },
    });
  }
  const pointsBalance = pointsEntries.reduce((sum, r) => sum + r.amount, 0);
  await prisma.userProfile.upsert({
    where: { userId: user.id },
    update: { pointsBalance, accountStatus: UserAccountStatus.COMPLETE },
    create: {
      userId: user.id,
      pointsBalance,
      accountStatus: UserAccountStatus.COMPLETE,
      company: "ConnectIQ 测试",
    },
  });
  dimensions.push(`积分(${pointsBalance})`);

  if (peerA && peerB) {
    await prisma.businessReferral.upsert({
      where: { id: `${PREFIX}-referral-sent` },
      update: { status: ReferralStatus.PENDING },
      create: {
        id: `${PREFIX}-referral-sent`,
        introducerId: user.id,
        recipientId: peerA.id,
        userAId: user.id,
        userBId: peerB.id,
        userAName: MOBILE_TEST_NAME,
        userACompany: "ConnectIQ 测试",
        userATitle: "产品经理",
        userBName: peerB.name,
        userBCompany: peerB.profile?.company ?? undefined,
        userBTitle: peerB.profile?.valueProposition ?? undefined,
        status: ReferralStatus.PENDING,
        message: "两位都在做 B2B SaaS，建议现场聊聊",
        aiConfidence: 0.88,
        eventId: event.id,
        eventName: event.name,
      },
    });
    dimensions.push("引荐(我发起)");
  }

  if (peerC) {
    await prisma.businessReferral.upsert({
      where: { id: `${PREFIX}-referral-recv` },
      update: { status: ReferralStatus.ACCEPTED },
      create: {
        id: `${PREFIX}-referral-recv`,
        introducerId: peerC.id,
        recipientId: user.id,
        userAId: peerC.id,
        userBId: user.id,
        userAName: peerC.name,
        userACompany: peerC.profile?.company ?? undefined,
        userBName: MOBILE_TEST_NAME,
        userBCompany: "ConnectIQ 测试",
        userBTitle: "产品经理",
        status: ReferralStatus.ACCEPTED,
        message: "王强推荐你认识，主题很匹配",
        eventId: event.id,
        eventName: event.name,
      },
    });
    dimensions.push("引荐(收到)");
  }

  await prisma.contactCard.upsert({
    where: { userId: user.id },
    update: { wechatId: "qian_test_ci" },
    create: { userId: user.id, wechatId: "qian_test_ci" },
  });
  dimensions.push("联系卡");

  const notifications = [
    {
      id: `${PREFIX}-notif-broadcast`,
      title: "B 厅入口临时调整",
      body: "因人流管控，B 厅入口改至北广场 2 号门，请注意引导标识。",
    },
    {
      id: `${PREFIX}-notif-exchange`,
      title: "李娜 请求与你交换微信",
      body: "李娜 · 云端互动 · 销售总监",
    },
    {
      id: `${PREFIX}-notif-meeting`,
      title: "会面提醒 · 14:30",
      body: "与张伟的 1v1 会面将在 10 分钟后开始，洽谈区 A 桌 01。",
    },
  ];
  for (const n of notifications) {
    await prisma.notification.upsert({
      where: { id: n.id },
      update: { title: n.title, body: n.body },
      create: { id: n.id, userId: user.id, title: n.title, body: n.body },
    });
  }
  dimensions.push("通知(3 条)");

  const feedItems = [
    {
      id: `${PREFIX}-feed-match`,
      type: FeedItemType.MATCH,
      content: "与张伟在意向标签「CRM软件」上高度匹配，建议发起连接。",
      aiScore: 86,
    },
    {
      id: `${PREFIX}-feed-insight`,
      type: FeedItemType.INSIGHT,
      content: "你在上午逛了 3 个智能制造展位，下午可重点关注营销自动化展区。",
      aiScore: 72,
    },
  ];
  for (const item of feedItems) {
    await prisma.feedItem.upsert({
      where: { id: item.id },
      update: { content: item.content },
      create: {
        id: item.id,
        userId: user.id,
        eventId: event.id,
        type: item.type,
        content: item.content,
        aiScore: item.aiScore,
        triggerReason: "mobile_test_seed",
      },
    });
  }
  dimensions.push("AI 动态(2 条)");

  const saasEvent = await prisma.event.findUnique({
    where: { slug: "saas-growth-summit-2025" },
    select: { id: true, name: true },
  });
  if (saasEvent && peerA) {
    await prisma.businessConnection.upsert({
      where: { id: `${PREFIX}-conn-summit` },
      update: {},
      create: {
        id: `${PREFIX}-conn-summit`,
        userAId: user.id,
        userBId: peerA.id,
        userAName: MOBILE_TEST_NAME,
        userACompany: "ConnectIQ 测试",
        userBName: peerA.name,
        userBCompany: peerA.profile?.company ?? undefined,
        source: ConnectionSource.SPEED_NETWORKING,
        eventId: saasEvent.id,
        eventName: saasEvent.name,
        aiScore: 79,
      },
    });
    dimensions.push("跨活动连接(SaaS峰会)");
  }

  return {
    userId: user.id,
    eventId: event.id,
    eventName: event.name,
    joinCode: MOBILE_TEST_JOIN_CODE,
    dimensions,
  };
}

async function main() {
  const result = await seedMobileTestAttendeeDimensions();
  console.log(`✓ ${MOBILE_TEST_PHONE} 全维度测试数据`);
  console.log(`  活动: ${result.eventName}`);
  console.log(`  活动码: ${result.joinCode}`);
  console.log(`  维度: ${result.dimensions.join(" · ")}`);
}

const isDirectRun =
  typeof process.argv[1] === "string" &&
  process.argv[1].replace(/\\/g, "/").includes("seed-mobile-test-dimensions");

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
