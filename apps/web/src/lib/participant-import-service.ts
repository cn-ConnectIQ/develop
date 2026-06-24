import { prisma } from "@connectiq/database";
import type { ImportRow } from "@/lib/participants";
import { generateBadgeQr } from "@/lib/participants";

export type ParticipantImportResult = {
  created: number;
  updated: number;
  skipped: number;
};

export async function upsertParticipantsFromRows(
  eventId: string,
  rows: ImportRow[],
  options?: { skipDuplicates?: boolean },
): Promise<ParticipantImportResult> {
  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const row of rows) {
    if (!row.phone?.trim()) {
      skipped++;
      continue;
    }

    const phone = row.phone.trim();
    const existing = await prisma.participant.findFirst({
      where: { eventId, phone },
    });

    if (existing) {
      if (options?.skipDuplicates) {
        skipped++;
        continue;
      }
      await prisma.participant.update({
        where: { id: existing.id },
        data: {
          name: row.name,
          company: row.company ?? existing.company,
          email: row.email ?? existing.email,
          jobTitle: row.jobTitle ?? existing.jobTitle,
          badgeQr: existing.badgeQr ?? generateBadgeQr(eventId),
        },
      });
      updated++;
    } else {
      await prisma.participant.create({
        data: {
          eventId,
          name: row.name,
          phone,
          email: row.email ?? null,
          company: row.company ?? null,
          jobTitle: row.jobTitle ?? null,
          badgeQr: generateBadgeQr(eventId),
        },
      });
      created++;
    }
  }

  return { created, updated, skipped };
}
