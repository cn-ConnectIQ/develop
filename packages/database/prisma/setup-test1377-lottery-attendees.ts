/**
 * TEST1377 · 50 名已签到模拟参会者（大屏抽奖 / 奖池测试）
 *
 * 用法：pnpm --filter @connectiq/database db:setup-test1377-lottery-attendees
 */
import {
  LotteryEntrySource,
  LotteryOwnerType,
  LotteryStatus,
  ParticipantInviteStatus,
  UserAccountStatus,
  UserType,
} from "@prisma/client";
import bcrypt from "bcryptjs";
import { prisma } from "../src/client";
import {
  MOBILE_TEST_PRIMARY_EVENT_SLUG,
  resolveTest1377EventId,
} from "./seed-mobile-test-dimensions";

const PREFIX = "seed-m1377-lottery";
const ATTENDEE_COUNT = 50;
const SEED_PASSWORD = "ConnectIQ2024!";
const PHONE_BASE = 139_137_700_00;

const COMPANIES = [
  "云图 CRM 科技",
  "智链工业软件",
  "海岳智能科技",
  "芯联传感",
  "企服优选",
  "MarTech 创新",
  "百格活动",
  "玖莅 测试",
  "未来智造",
  "数智会展",
];

const JOB_TITLES = ["产品经理", "技术总监", "采购经理", "CEO", "运营总监"];

function phoneToEmail(phone: string) {
  return `${phone}@phone.connectiq.local`;
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

async function resolveTest1377Event() {
  const eventId = await resolveTest1377EventId();
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, name: true, status: true },
  });
  if (event) return event;

  const bySlug = await prisma.event.findUnique({
    where: { slug: MOBILE_TEST_PRIMARY_EVENT_SLUG },
    select: { id: true, name: true, status: true },
  });
  if (bySlug) return bySlug;

  throw new Error(
    "TEST1377 活动不存在，请先执行 db:seed 与 db:seed:mobile-test-dimensions",
  );
}

async function syncOpenOrganizerLotteryEntries(eventId: string, userIds: string[]) {
  const lotteries = await prisma.lottery.findMany({
    where: {
      eventId,
      ownerType: LotteryOwnerType.ORGANIZER,
      boothId: null,
      status: { in: [LotteryStatus.OPEN, LotteryStatus.DRAWING, LotteryStatus.ACTIVE] },
    },
    select: { id: true, title: true, status: true },
  });

  if (lotteries.length === 0) {
    return { lotteryCount: 0, totalSynced: 0 };
  }

  let totalSynced = 0;
  for (const lottery of lotteries) {
    const existing = await prisma.lotteryEntry.findMany({
      where: { lotteryId: lottery.id, userId: { in: userIds } },
      select: { userId: true },
    });
    const existingSet = new Set(existing.map((row) => row.userId));
    const toCreate = userIds.filter((userId) => !existingSet.has(userId));

    if (toCreate.length > 0) {
      await prisma.lotteryEntry.createMany({
        data: toCreate.map((userId) => ({
          lotteryId: lottery.id,
          userId,
          source: LotteryEntrySource.AUTO_CHECKIN,
        })),
        skipDuplicates: true,
      });
      totalSynced += toCreate.length;
    }

    const entry_count = await prisma.lotteryEntry.count({
      where: { lotteryId: lottery.id },
    });
    await prisma.lottery.update({
      where: { id: lottery.id },
      data: { entryCount: entry_count },
    });

    console.log(
      `  ↳ 奖池「${lottery.title}」参与 ${entry_count} 人（本次 +${toCreate.length}）`,
    );
  }

  return { lotteryCount: lotteries.length, totalSynced };
}

async function main() {
  const event = await resolveTest1377Event();
  const passwordHash = await bcrypt.hash(SEED_PASSWORD, 12);
  const checkedInAt = new Date();

  console.log(`\n🎲 TEST1377 抽奖测试观众 × ${ATTENDEE_COUNT}\n`);
  console.log(`  活动: ${event.name} (${event.id})\n`);

  const userIds: string[] = [];

  for (let i = 1; i <= ATTENDEE_COUNT; i += 1) {
    const seq = pad2(i);
    const phone = String(PHONE_BASE + i);
    const email = phoneToEmail(phone);
    const name = `测试观众${seq}`;
    const participantId = `${PREFIX}-p-${seq}`;
    const userId = `${PREFIX}-u-${seq}`;
    const checkInId = `${PREFIX}-checkin-${seq}`;

    const company = COMPANIES[(i - 1) % COMPANIES.length]!;
    const jobTitle = JOB_TITLES[(i - 1) % JOB_TITLES.length]!;

    await prisma.user.upsert({
      where: { email },
      update: {
        phone,
        name,
        userType: UserType.END_USER,
        passwordHash,
      },
      create: {
        id: userId,
        email,
        phone,
        name,
        passwordHash,
        userType: UserType.END_USER,
      },
    });

    const user = await prisma.user.findUniqueOrThrow({
      where: { email },
      select: { id: true },
    });

    await prisma.userProfile.upsert({
      where: { userId: user.id },
      update: {
        accountStatus: UserAccountStatus.COMPLETE,
        company,
        valueProposition: jobTitle,
      },
      create: {
        userId: user.id,
        accountStatus: UserAccountStatus.COMPLETE,
        company,
        valueProposition: jobTitle,
      },
    });

    await prisma.participant.upsert({
      where: { id: participantId },
      update: {
        phone,
        email,
        name,
        company,
        jobTitle,
        inviteStatus: ParticipantInviteStatus.ACTIVATED,
      },
      create: {
        id: participantId,
        eventId: event.id,
        phone,
        email,
        name,
        company,
        jobTitle,
        inviteStatus: ParticipantInviteStatus.ACTIVATED,
      },
    });

    await prisma.checkIn.upsert({
      where: {
        eventId_participantId: {
          eventId: event.id,
          participantId,
        },
      },
      update: { checkedInAt, method: "seed" },
      create: {
        id: checkInId,
        eventId: event.id,
        participantId,
        method: "seed",
        checkedInAt,
      },
    });

    userIds.push(user.id);
  }

  const checkInCount = await prisma.checkIn.count({
    where: { eventId: event.id, participantId: { startsWith: PREFIX } },
  });

  console.log(`✅ 已就绪 ${checkInCount} 名已签到测试观众`);
  console.log(`  手机号段: ${PHONE_BASE + 1} – ${PHONE_BASE + ATTENDEE_COUNT}`);
  console.log(`  示例: 测试观众01 · ${COMPANIES[0]} · ${phoneToEmail(String(PHONE_BASE + 1))}`);

  console.log("\n📥 同步进行中的主办方奖池…");
  const sync = await syncOpenOrganizerLotteryEntries(event.id, userIds);
  if (sync.lotteryCount === 0) {
    console.log("  （暂无 OPEN/DRAWING 状态的全场抽奖，发布抽奖后可在控制台重新同步奖池）");
  } else {
    console.log(`✅ 已处理 ${sync.lotteryCount} 个奖池，新增 ${sync.totalSynced} 条参与记录`);
  }

  const totalCheckedIn = await prisma.checkIn.count({ where: { eventId: event.id } });
  console.log(`\n📊 活动当前签到总人数: ${totalCheckedIn}\n`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
