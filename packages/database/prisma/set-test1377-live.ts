import { EventStatus, ReviewStatus } from "@prisma/client";
import { prisma } from "../src/client";
import {
  MOBILE_TEST_PRIMARY_EVENT_SLUG,
  resolveTest1377EventId,
} from "./seed-mobile-test-dimensions";

async function main() {
  const eventId = await resolveTest1377EventId();
  const startDate = new Date(Date.now() - 86_400_000);
  const endDate = new Date(Date.now() + 2 * 86_400_000 + 18 * 3_600_000);
  const data = {
    status: EventStatus.LIVE,
    reviewStatus: ReviewStatus.LIVE,
    startDate,
    endDate,
  };

  const updated = await prisma.event.update({
    where: { id: eventId },
    data,
    select: {
      id: true,
      name: true,
      status: true,
      reviewStatus: true,
      startDate: true,
      endDate: true,
    },
  });

  console.log("✓ TEST1377 活动已设为进行中");
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
