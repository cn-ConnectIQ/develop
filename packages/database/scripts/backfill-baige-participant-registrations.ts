/**
 * 一次性回填：把历史上通过 `tags: ["baige_reg:<id>"]` 标记的百格参会人，
 * 补建为正式的 ParticipantRegistration(provider="baige", externalId=<id>) 记录，
 * 避免新的通用同步机制上线后把这些人重复处理。
 *
 * 运行：pnpm --filter @connectiq/database tsx scripts/backfill-baige-participant-registrations.ts
 */
import { prisma, RegistrationStatus } from "../src/client";

const PROVIDER = "baige";
const TAG_PREFIX = "baige_reg:";

async function main() {
  // Prisma 的 String[] 过滤不支持前缀匹配，这里直接扫描全部带 tags 的参会人再在内存里筛选
  const candidates = await prisma.participant.findMany({
    where: { tags: { isEmpty: false } },
    select: { id: true, tags: true },
  });

  let created = 0;
  let skippedExisting = 0;
  let skippedDuplicate = 0;

  for (const participant of candidates) {
    const tag = participant.tags.find((t) => t.startsWith(TAG_PREFIX));
    if (!tag) continue;
    const externalId = tag.slice(TAG_PREFIX.length).trim();
    if (!externalId) continue;

    const existingByExternalId = await prisma.participantRegistration.findUnique({
      where: { provider_externalId: { provider: PROVIDER, externalId } },
    });
    if (existingByExternalId) {
      skippedDuplicate++;
      continue;
    }

    const existingForParticipant = await prisma.participantRegistration.findFirst({
      where: { participantId: participant.id, provider: PROVIDER },
    });
    if (existingForParticipant) {
      skippedExisting++;
      continue;
    }

    await prisma.participantRegistration.create({
      data: {
        participantId: participant.id,
        provider: PROVIDER,
        externalId,
        externalStatus: null,
        status: RegistrationStatus.CONFIRMED,
        syncedAt: new Date(),
      },
    });
    created++;
  }

  console.log(
    JSON.stringify(
      {
        scanned: candidates.length,
        created,
        skippedExisting,
        skippedDuplicate,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
