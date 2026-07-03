import { prisma } from "@connectiq/database";
import type { ImportRow } from "@/lib/participants";
import { recordTrialSignal } from "@/lib/organizer-trial-service";
import { upsertParticipantsFromRowsWithMerge } from "@/lib/participant-merge";

export type ParticipantImportResult = {
  created: number;
  updated: number;
  skipped: number;
  merged: number;
};

export async function upsertParticipantsFromRows(
  eventId: string,
  rows: ImportRow[],
  options?: { skipDuplicates?: boolean },
): Promise<ParticipantImportResult> {
  const result = await upsertParticipantsFromRowsWithMerge(
    eventId,
    rows.map((row) => ({
      name: row.name,
      phone: row.phone,
      email: row.email,
      company: row.company,
      jobTitle: row.jobTitle,
      tags: row.tags,
    })),
    options,
  );

  const imported = result.created + result.updated;
  if (imported > 0) {
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { orgId: true },
    });
    if (event?.orgId) {
      void recordTrialSignal(event.orgId, "participants_imported", {
        eventId,
        count: imported,
      });
    }
  }

  return result;
}
