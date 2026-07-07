import { EventStatus, ReviewStatus } from "@prisma/client";
import { prisma } from "../src/client";
import {
  MOBILE_TEST_PRIMARY_EVENT_SLUG,
  resolveTest1377EventId,
} from "./seed-mobile-test-dimensions";

const FIVE_DAYS_MS = 5 * 86_400_000;

async function extendEvent(id: string) {
  const event = await prisma.event.findUnique({
    where: { id },
    select: { id: true, name: true, endDate: true, startDate: true, status: true },
  });
  if (!event) return null;

  const base =
    event.endDate && event.endDate.getTime() > Date.now()
      ? event.endDate
      : new Date();
  const endDate = new Date(base.getTime() + FIVE_DAYS_MS);

  return prisma.event.update({
    where: { id },
    data: {
      endDate,
      status: EventStatus.LIVE,
      reviewStatus: ReviewStatus.LIVE,
    },
    select: { id: true, name: true, startDate: true, endDate: true, status: true },
  });
}

async function main() {
  const eventId = await resolveTest1377EventId();
  const primary = await extendEvent(eventId);
  if (!primary) throw new Error("TEST1377 event not found");

  console.log("Extended primary:", JSON.stringify(primary, null, 2));

  const bySlug = await prisma.event.findUnique({
    where: { slug: MOBILE_TEST_PRIMARY_EVENT_SLUG },
    select: { id: true },
  });

  if (bySlug && bySlug.id !== primary.id) {
    const synced = await extendEvent(bySlug.id);
    console.log("Extended slug copy:", JSON.stringify(synced, null, 2));
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
