/**
 * TEST1377 · 未激活邀请测试账号
 * Milo / 19951984030 — 已发邀请、待激活（可反复跑本脚本重置）
 *
 * 用法：pnpm --filter @connectiq/database db:setup-test1377-attendee-milo-invite-pending
 */
import {
  InviteCampaignStatus,
  InviteChannel,
  InviteRecordStatus,
  ParticipantInviteStatus,
  ParticipantSource,
  UserAccountStatus,
  UserType,
} from "@prisma/client";
import { prisma } from "../src/client";
import { resolveTest1377EventId } from "./seed-mobile-test-dimensions";

const PHONE = "19951984030";
const NAME = "Milo";
const COMPANY = "百格活动";
const JOB_TITLE = "CEO";
const EMAIL = `${PHONE}@phone.connectiq.local`;

const PARTICIPANT_ID = "seed-m1377-attendee-milo";
const CAMPAIGN_ID = "seed-m1377-campaign-milo-invite";
const INVITE_RECORD_ID = "seed-m1377-invite-milo";
/** 固定 token，便于小程序 /join 与 AC1 联调 */
const ACTIVATION_TOKEN = "seed-m1377-milo-activation-token";
const CHECKIN_ID = `seed-checkin-${PARTICIPANT_ID}`;

function tokenExpiresAt(eventEnd: Date | null) {
  const base = eventEnd ?? new Date();
  const expires = new Date(base);
  expires.setDate(expires.getDate() + 30);
  return expires;
}

function buildActivationLinks(eventId: string) {
  const appBase =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
    "https://connectiq-web-git-develop-miloqians-projects.vercel.app";
  const joinUrl = `${appBase}/join?token=${encodeURIComponent(ACTIVATION_TOKEN)}&event=${eventId}`;
  const miniPath = `/pages/activation/landing?eventId=${eventId}&invite=${ACTIVATION_TOKEN}`;
  return { joinUrl, miniPath };
}

async function main() {
  const eventId = await resolveTest1377EventId();
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      name: true,
      endDate: true,
      organizerId: true,
    },
  });
  if (!event) {
    throw new Error(
      `TEST1377 活动不存在（id=${eventId}），请先跑 seed / db:seed:mobile-test-dimensions`,
    );
  }

  const expires = tokenExpiresAt(event.endDate);

  await prisma.participant.upsert({
    where: { id: PARTICIPANT_ID },
    update: {
      eventId: event.id,
      phone: PHONE,
      email: EMAIL,
      name: NAME,
      company: COMPANY,
      jobTitle: JOB_TITLE,
      inviteStatus: ParticipantInviteStatus.INVITED,
      source: ParticipantSource.INVITE,
      tags: ["VIP"],
    },
    create: {
      id: PARTICIPANT_ID,
      eventId: event.id,
      phone: PHONE,
      email: EMAIL,
      name: NAME,
      company: COMPANY,
      jobTitle: JOB_TITLE,
      inviteStatus: ParticipantInviteStatus.INVITED,
      source: ParticipantSource.INVITE,
      tags: ["VIP"],
    },
  });

  await prisma.inviteCampaign.upsert({
    where: { id: CAMPAIGN_ID },
    update: {
      eventId: event.id,
      name: "【联调】Milo 邀请激活测试",
      channel: InviteChannel.SMS,
      status: InviteCampaignStatus.SENT,
      totalTarget: 1,
      sentCount: 1,
      deliveredCount: 1,
      clickedCount: 0,
      activatedCount: 0,
      failedCount: 0,
      completedAt: new Date(),
    },
    create: {
      id: CAMPAIGN_ID,
      eventId: event.id,
      createdBy: event.organizerId,
      name: "【联调】Milo 邀请激活测试",
      channel: InviteChannel.SMS,
      status: InviteCampaignStatus.SENT,
      totalTarget: 1,
      sentCount: 1,
      deliveredCount: 1,
      clickedCount: 0,
      activatedCount: 0,
      failedCount: 0,
      startedAt: new Date(),
      completedAt: new Date(),
    },
  });

  await prisma.inviteRecord.upsert({
    where: { id: INVITE_RECORD_ID },
    update: {
      campaignId: CAMPAIGN_ID,
      participantId: PARTICIPANT_ID,
      userId: null,
      channel: InviteChannel.SMS,
      destination: PHONE,
      activationToken: ACTIVATION_TOKEN,
      tokenExpiresAt: expires,
      status: InviteRecordStatus.SENT,
      sentAt: new Date(),
      deliveredAt: new Date(),
      clickedAt: null,
      activatedAt: null,
    },
    create: {
      id: INVITE_RECORD_ID,
      campaignId: CAMPAIGN_ID,
      participantId: PARTICIPANT_ID,
      channel: InviteChannel.SMS,
      destination: PHONE,
      activationToken: ACTIVATION_TOKEN,
      tokenExpiresAt: expires,
      status: InviteRecordStatus.SENT,
      sentAt: new Date(),
      deliveredAt: new Date(),
    },
  });

  const existingUser = await prisma.user.findFirst({
    where: { OR: [{ phone: PHONE }, { email: EMAIL }] },
    select: { id: true },
  });

  if (existingUser) {
    await prisma.userEventIntent.deleteMany({
      where: { userId: existingUser.id, eventId: event.id },
    });
    await prisma.userProfile.upsert({
      where: { userId: existingUser.id },
      update: {
        accountStatus: UserAccountStatus.SHADOW,
        company: null,
        valueProposition: null,
        industry: null,
        intentTags: [],
      },
      create: {
        userId: existingUser.id,
        accountStatus: UserAccountStatus.SHADOW,
      },
    });
    await prisma.user.update({
      where: { id: existingUser.id },
      data: {
        phone: PHONE,
        name: NAME,
        userType: UserType.END_USER,
      },
    });
  }

  await prisma.checkIn.deleteMany({
    where: { participantId: PARTICIPANT_ID, eventId: event.id },
  }).catch(() => undefined);

  try {
    await prisma.checkIn.delete({ where: { id: CHECKIN_ID } });
  } catch {
    // ignore
  }

  const links = buildActivationLinks(event.id);

  console.log("\n✅ TEST1377 未激活邀请账号已就绪（可重复执行本脚本重置）\n");
  console.log(`  活动: ${event.name}`);
  console.log(`  活动码: TEST1377`);
  console.log(`  手机号: ${PHONE}`);
  console.log(`  姓名: ${NAME} · ${COMPANY} · ${JOB_TITLE}`);
  console.log(`  参会者状态: INVITED（未激活）`);
  console.log(`  邀请记录: SENT`);
  console.log(`  用户资料: ${existingUser ? "SHADOW（需走 AC4/AC5）" : "无账号（AC2 手机号注册）"}`);
  console.log(`\n  activationToken:\n    ${ACTIVATION_TOKEN}`);
  console.log(`\n  H5 邀请链接:\n    ${links.joinUrl}`);
  console.log(`\n  小程序激活页路径:\n    ${links.miniPath}`);
  console.log(`\n  测试步骤:`);
  console.log(`    1. 微信开发者工具编译后，在「编译模式」填入上述路径`);
  console.log(`    2. 或扫码进入 AC1 → 输入 ${PHONE} → 验证码 888888（开发环境）`);
  console.log(`    3. 完成 AC4 身份 + AC5 意图后，主办方后台可看到「已激活」\n`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
