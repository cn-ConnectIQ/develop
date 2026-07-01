/**
 * TEST1377 主办方 AD 演示数据：待审展商 + 展位热度 + 连接/签到快照
 * 用法：pnpm --filter @connectiq/database db:setup-test1377-admin
 */
import {
  BoothStatus,
  ConnectionSource,
  ConnectionStatus,
  SignalType,
} from "@prisma/client";
import { prisma } from "../src/client";
import { MOBILE_TEST_PRODUCTION_EVENT_ID } from "./seed-mobile-test-dimensions";
import {
  ensureExhibitorOperator,
  PENDING_BOOTH_OPERATORS,
} from "./setup-test1377-booth-staff";

const PREFIX = "seed-m1377-admin";
const EVENT_ID = MOBILE_TEST_PRODUCTION_EVENT_ID;
const ADMIN_PHONE = "13770626459";

const PENDING_BOOTHS = [
  { code: "E-06", name: "海岳智能待审展位", company: "海岳智能科技" },
  { code: "F-11", name: "芯联传感待审展位", company: "芯联传感" },
];

async function main() {
  const event = await prisma.event.findUnique({
    where: { id: EVENT_ID },
    select: { id: true, name: true, orgId: true },
  });
  if (!event) throw new Error("TEST1377 活动不存在");

  const admin = await prisma.user.findFirst({
    where: { phone: ADMIN_PHONE },
    select: { id: true },
  });

  for (const row of PENDING_BOOTHS) {
    const org = await prisma.organization.upsert({
      where: { slug: `${PREFIX}-${row.code.toLowerCase()}` },
      update: { name: row.company },
      create: {
        slug: `${PREFIX}-${row.code.toLowerCase()}`,
        name: row.company,
        adminStatus: "APPROVED",
        isVerified: false,
      },
    });

    const boothId = `${PREFIX}-booth-${row.code.replace(/[^a-z0-9]/gi, "")}`;
    await prisma.exhibitorBooth.upsert({
      where: { id: boothId },
      update: {
        name: row.name,
        code: row.code,
        companyOrgId: org.id,
        status: BoothStatus.BOOKED,
      },
      create: {
        id: boothId,
        eventId: EVENT_ID,
        code: row.code,
        name: row.name,
        hallLabel: "2 号馆",
        companyOrgId: org.id,
        status: BoothStatus.BOOKED,
      },
    });

    const operatorSpec = PENDING_BOOTH_OPERATORS.find((s) => s.code === row.code);
    if (operatorSpec) {
      await ensureExhibitorOperator({
        orgId: org.id,
        orgSlug: operatorSpec.orgSlug,
        company: operatorSpec.company,
        phone: operatorSpec.phone,
        name: operatorSpec.name,
        boothId,
      });
    }
  }

  const booths = await prisma.exhibitorBooth.findMany({
    where: { eventId: EVENT_ID },
    select: { id: true, code: true },
    take: 8,
  });

  if (admin && booths.length > 0) {
    const heatPlan = [12, 9, 7, 5, 4, 3, 2, 1];
    for (let i = 0; i < booths.length; i += 1) {
      const booth = booths[i]!;
      const count = heatPlan[i] ?? 1;
      const signals = Array.from({ length: count }, (_, j) => ({
        userId: admin.id,
        eventId: EVENT_ID,
        signalType: SignalType.BOOTH_SCAN,
        entityId: booth.id,
        entityType: "BOOTH" as const,
        payload: { source: PREFIX, booth_code: booth.code, seq: j },
        occurredAt: new Date(Date.now() - j * 15 * 60 * 1000),
      }));
      await prisma.boothVisitSignal.createMany({ data: signals, skipDuplicates: true });
    }
  }

  const users = await prisma.user.findMany({
    where: {
      OR: [
        { phone: { in: ["13770626459", "13800000005", "13800000006"] } },
        {
          ownedOrg: {
            staff: {
              some: { status: "ACCEPTED" },
            },
          },
        },
      ],
    },
    select: { id: true, name: true, profile: { select: { company: true } } },
    take: 6,
  });

  if (users.length >= 2) {
    for (let i = 0; i < users.length - 1; i += 1) {
      const userA = users[i]!;
      const userB = users[i + 1]!;
      const existing = await prisma.businessConnection.findFirst({
        where: {
          eventId: EVENT_ID,
          OR: [
            { userAId: userA.id, userBId: userB.id },
            { userAId: userB.id, userBId: userA.id },
          ],
        },
      });
      if (!existing) {
        await prisma.businessConnection.create({
          data: {
            eventId: EVENT_ID,
            eventName: event.name,
            userAId: userA.id,
            userBId: userB.id,
            userAName: userA.name,
            userACompany: userA.profile?.company,
            userBName: userB.name,
            userBCompany: userB.profile?.company,
            source: ConnectionSource.SCAN,
            status: ConnectionStatus.ACTIVE,
          },
        });
      }
    }
  }

  console.log(`✅ TEST1377 主办方演示数据已就绪`);
  console.log(`   活动: ${event.name}`);
  console.log(`   待审展商: ${PENDING_BOOTHS.map((b) => b.code).join(", ")}`);
  console.log(`   展位热度信号: ${booths.length} 个展位`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
