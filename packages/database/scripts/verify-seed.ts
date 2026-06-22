import { prisma } from "../src/client";

async function main() {
  const [stampRallies, boothVisitSignals, boothsWithCoords, winners] =
    await Promise.all([
      prisma.stampRally.count(),
      prisma.boothVisitSignal.count(),
      prisma.exhibitorBooth.count({ where: { positionX: { not: null } } }),
      prisma.stampRallyWinner.count(),
    ]);

  const rally = await prisma.stampRally.findFirst({
    where: { id: "seed-stamp-rally-expo" },
    select: { name: true, status: true, boothIds: true },
  });

  console.log(
    JSON.stringify(
      {
        stampRallies,
        boothVisitSignals,
        boothsWithCoords,
        winners,
        sampleRally: rally,
      },
      null,
      2,
    ),
  );
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
