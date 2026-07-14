import { EventStatus, ReviewStatus } from "@prisma/client";
import { prisma } from "../src/client";
import {
  MOBILE_TEST_PRIMARY_EVENT_SLUG,
  resolveTest1377EventId,
} from "./seed-mobile-test-dimensions";

/** 长期活动：保持 LIVE，结束时间拉到远期，避免联调被「已结束」拦住 */
function longTermWindow() {
  const startDate = new Date("2025-01-01T00:00:00.000Z");
  const endDate = new Date("2099-12-31T23:59:59.000Z");
  return {
    status: EventStatus.LIVE,
    reviewStatus: ReviewStatus.LIVE,
    startDate,
    endDate,
  };
}

async function main() {
  const eventId = await resolveTest1377EventId();
  const data = longTermWindow();

  const updated = await prisma.event.update({
    where: { id: eventId },
    data,
    select: {
      id: true,
      name: true,
      slug: true,
      status: true,
      reviewStatus: true,
      startDate: true,
      endDate: true,
    },
  });

  console.log("✓ TEST1377 已设为长期进行中活动");
  console.log(JSON.stringify(updated, null, 2));

  const bySlug = await prisma.event.findUnique({
    where: { slug: MOBILE_TEST_PRIMARY_EVENT_SLUG },
    select: { id: true },
  });
  if (bySlug && bySlug.id !== updated.id) {
    await prisma.event.update({ where: { id: bySlug.id }, data });
    console.log(`✓ 同步 slug 活动 ${MOBILE_TEST_PRIMARY_EVENT_SLUG}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
