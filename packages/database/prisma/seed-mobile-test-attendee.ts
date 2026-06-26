import {
  ParticipantInviteStatus,
  SignalType,
  UserAccountStatus,
  UserType,
} from "@prisma/client";
import bcrypt from "bcryptjs";
import { prisma } from "../src/client";

/** 移动端联调测试手机号（与 seed 保持一致） */
export const MOBILE_TEST_PHONE = "13770626459";

const MOBILE_TEST_NAME = "钱测试";
const SEED_PASSWORD = "ConnectIQ2024!";

const EVENT_SLUGS = [
  "saas-growth-summit-2025",
  "product-growth-salon-beijing",
  "innovation-summit-2025",
  "smart-link-industry-expo-2026",
  "enterprise-digital-expo-2025",
] as const;

function phoneToEmail(phone: string) {
  return `${phone}@phone.connectiq.local`;
}

function daysAgo(days: number, hours = 10) {
  return new Date(Date.now() - days * 86_400_000 - hours * 3_600_000);
}

async function upsertMobileTestUser() {
  const passwordHash = await bcrypt.hash(SEED_PASSWORD, 12);
  const email = phoneToEmail(MOBILE_TEST_PHONE);

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      phone: MOBILE_TEST_PHONE,
      name: MOBILE_TEST_NAME,
      userType: UserType.END_USER,
      passwordHash,
    },
    create: {
      email,
      phone: MOBILE_TEST_PHONE,
      name: MOBILE_TEST_NAME,
      passwordHash,
      userType: UserType.END_USER,
    },
  });

  await prisma.userProfile.upsert({
    where: { userId: user.id },
    update: {
      accountStatus: UserAccountStatus.COMPLETE,
      company: "ConnectIQ 测试",
      industry: "活动科技",
      valueProposition: "产品经理",
    },
    create: {
      userId: user.id,
      accountStatus: UserAccountStatus.COMPLETE,
      company: "ConnectIQ 测试",
      industry: "活动科技",
      valueProposition: "产品经理",
    },
  });

  return user;
}

export type MobileTestAttendeeResult = {
  userId: string;
  eventCount: number;
  eventNames: string[];
};

/**
 * 将 MOBILE_TEST_PHONE 注册为 END_USER，并加入演示活动参会者列表。
 * 可通过完整 seed 或 `pnpm db:seed:mobile-test` 单独执行。
 */
export async function seedMobileTestAttendee(): Promise<MobileTestAttendeeResult> {
  const events = await prisma.event.findMany({
    where: { slug: { in: [...EVENT_SLUGS] } },
    select: { id: true, slug: true, name: true, status: true },
  });

  const bySlug = new Map(events.map((e) => [e.slug, e]));
  const missing = EVENT_SLUGS.filter((slug) => !bySlug.has(slug));
  if (missing.length > 0) {
    throw new Error(
      `缺少演示活动（请先 pnpm db:seed）：${missing.join(", ")}`,
    );
  }

  const user = await upsertMobileTestUser();
  const email = phoneToEmail(MOBILE_TEST_PHONE);

  const participantSpecs = EVENT_SLUGS.map((slug) => {
    const event = bySlug.get(slug)!;
    const slugKey = slug.replace(/-/g, "_");
    return {
      id: `seed-part-mobile-test-${slugKey}`,
      eventId: event.id,
      eventName: event.name,
      checkedIn: event.status === "LIVE",
    };
  });

  for (const spec of participantSpecs) {
    await prisma.participant.upsert({
      where: { id: spec.id },
      update: {
        phone: MOBILE_TEST_PHONE,
        email,
        name: MOBILE_TEST_NAME,
        company: "ConnectIQ 测试",
        jobTitle: "产品经理",
        inviteStatus: ParticipantInviteStatus.ACTIVATED,
      },
      create: {
        id: spec.id,
        eventId: spec.eventId,
        phone: MOBILE_TEST_PHONE,
        email,
        name: MOBILE_TEST_NAME,
        company: "ConnectIQ 测试",
        jobTitle: "产品经理",
        inviteStatus: ParticipantInviteStatus.ACTIVATED,
      },
    });

    await prisma.userEventIntent.upsert({
      where: {
        userId_eventId: { userId: user.id, eventId: spec.eventId },
      },
      update: {
        role: "产品经理",
        supplyTags: ["SaaS产品", "B2B营销"],
        demandTags: ["CRM软件", "营销自动化"],
        topics: ["渠道合作", "产品增长"],
      },
      create: {
        userId: user.id,
        eventId: spec.eventId,
        role: "产品经理",
        supplyTags: ["SaaS产品", "B2B营销"],
        demandTags: ["CRM软件", "营销自动化"],
        topics: ["渠道合作", "产品增长"],
      },
    });

    if (spec.checkedIn) {
      await prisma.checkIn.upsert({
        where: { id: `seed-checkin-${spec.id}` },
        update: { checkedInAt: daysAgo(0, 1) },
        create: {
          id: `seed-checkin-${spec.id}`,
          eventId: spec.eventId,
          participantId: spec.id,
          method: "qr",
          checkedInAt: daysAgo(0, 1),
        },
      });
    }
  }

  const hostedExpo = bySlug.get("smart-link-industry-expo-2026");
  if (hostedExpo) {
    const booth = await prisma.exhibitorBooth.findFirst({
      where: { eventId: hostedExpo.id, code: "A-101" },
      select: { id: true },
    });
    if (booth) {
      await prisma.boothVisitSignal.createMany({
        data: [
          {
            userId: user.id,
            eventId: hostedExpo.id,
            signalType: SignalType.BOOTH_SCAN,
            entityId: booth.id,
            entityType: "BOOTH",
            payload: { source: "mobile_test_seed" },
          },
        ],
        skipDuplicates: true,
      });
    }
  }

  return {
    userId: user.id,
    eventCount: participantSpecs.length,
    eventNames: participantSpecs.map((s) => s.eventName),
  };
}

async function main() {
  const result = await seedMobileTestAttendee();
  console.log(`✓ 移动端测试账号 ${MOBILE_TEST_PHONE}（${MOBILE_TEST_NAME}）`);
  console.log(`  已加入 ${result.eventCount} 场活动：`);
  for (const name of result.eventNames) {
    console.log(`    · ${name}`);
  }
  console.log(`  登录邮箱: ${phoneToEmail(MOBILE_TEST_PHONE)}`);
  console.log(`  密码: ${SEED_PASSWORD}`);
  console.log("  小程序：请使用 wx-login-phone 绑定此手机号，或验证码登录");
}

const isDirectRun =
  typeof process.argv[1] === "string" &&
  process.argv[1].replace(/\\/g, "/").includes("seed-mobile-test-attendee");

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
