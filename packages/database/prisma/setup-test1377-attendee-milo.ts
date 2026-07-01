/**
 * TEST1377 测试观众：Milo / 19951984030 / 百格活动 / CEO
 * 用法：pnpm --filter @connectiq/database db:setup-test1377-attendee-milo
 */
import {
  ParticipantInviteStatus,
  UserAccountStatus,
  UserType,
} from "@prisma/client";
import bcrypt from "bcryptjs";
import { prisma } from "../src/client";
import { MOBILE_TEST_PRODUCTION_EVENT_ID } from "./seed-mobile-test-dimensions";

const PHONE = "19951984030";
const NAME = "Milo";
const COMPANY = "百格活动";
const JOB_TITLE = "CEO";
const SEED_PASSWORD = "ConnectIQ2024!";
const PARTICIPANT_ID = "seed-m1377-attendee-milo";
const CHECKIN_ID = `seed-checkin-${PARTICIPANT_ID}`;

function phoneToEmail(phone: string) {
  return `${phone}@phone.connectiq.local`;
}

async function main() {
  const event = await prisma.event.findUnique({
    where: { id: MOBILE_TEST_PRODUCTION_EVENT_ID },
    select: { id: true, name: true, status: true },
  });
  if (!event) throw new Error("TEST1377 活动不存在");

  const passwordHash = await bcrypt.hash(SEED_PASSWORD, 12);
  const email = phoneToEmail(PHONE);

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      phone: PHONE,
      name: NAME,
      userType: UserType.END_USER,
      passwordHash,
    },
    create: {
      email,
      phone: PHONE,
      name: NAME,
      passwordHash,
      userType: UserType.END_USER,
    },
  });

  await prisma.userProfile.upsert({
    where: { userId: user.id },
    update: {
      accountStatus: UserAccountStatus.COMPLETE,
      company: COMPANY,
      valueProposition: JOB_TITLE,
    },
    create: {
      userId: user.id,
      accountStatus: UserAccountStatus.COMPLETE,
      company: COMPANY,
      valueProposition: JOB_TITLE,
    },
  });

  await prisma.participant.upsert({
    where: { id: PARTICIPANT_ID },
    update: {
      phone: PHONE,
      email,
      name: NAME,
      company: COMPANY,
      jobTitle: JOB_TITLE,
      inviteStatus: ParticipantInviteStatus.ACTIVATED,
    },
    create: {
      id: PARTICIPANT_ID,
      eventId: event.id,
      phone: PHONE,
      email,
      name: NAME,
      company: COMPANY,
      jobTitle: JOB_TITLE,
      inviteStatus: ParticipantInviteStatus.ACTIVATED,
    },
  });

  await prisma.userEventIntent.upsert({
    where: {
      userId_eventId: { userId: user.id, eventId: event.id },
    },
    update: {
      role: JOB_TITLE,
      supplyTags: ["活动运营", "会展服务"],
      demandTags: ["活动科技", "数字化会展"],
      topics: ["百格活动", "CEO 视角联调"],
    },
    create: {
      userId: user.id,
      eventId: event.id,
      role: JOB_TITLE,
      supplyTags: ["活动运营", "会展服务"],
      demandTags: ["活动科技", "数字化会展"],
      topics: ["百格活动", "CEO 视角联调"],
    },
  });

  if (event.status === "LIVE") {
    await prisma.checkIn.upsert({
      where: { id: CHECKIN_ID },
      update: { checkedInAt: new Date() },
      create: {
        id: CHECKIN_ID,
        eventId: event.id,
        participantId: PARTICIPANT_ID,
        method: "qr",
        checkedInAt: new Date(),
      },
    });
  }

  console.log("✅ TEST1377 观众 Milo 已就绪");
  console.log(`  活动: ${event.name} (${event.id})`);
  console.log(`  手机号: ${PHONE}`);
  console.log(`  姓名: ${NAME} · ${COMPANY} · ${JOB_TITLE}`);
  console.log(`  userId: ${user.id}`);
  console.log(`  participantId: ${PARTICIPANT_ID}`);
  console.log(`  小程序登录: 验证码 888888（开发环境）`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
