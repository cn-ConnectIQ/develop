import { prisma } from "@connectiq/database";
import type { ImportRow } from "@/lib/participants";
import { maybeAutoInviteNewParticipants } from "@/lib/invite/send-fixed-invites";
import { recordTrialSignal } from "@/lib/organizer-trial-service";
import { upsertParticipantsFromRowsWithMerge } from "@/lib/participant-merge";

export type ParticipantImportResult = {
  created: number;
  updated: number;
  skipped: number;
  merged: number;
  createdIds: string[];
  autoInviteQueued?: number;
};

export async function upsertParticipantsFromRows(
  eventId: string,
  rows: ImportRow[],
  options?: {
    skipDuplicates?: boolean;
    createdBy?: string | null;
    /** 为 true 时跳过自动邀请（例如手工邀请流程内已有发送） */
    skipAutoInvite?: boolean;
  },
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

  let autoInviteQueued = 0;
  if (!options?.skipAutoInvite && result.createdIds.length > 0) {
    try {
      const auto = await maybeAutoInviteNewParticipants({
        eventId,
        participantIds: result.createdIds,
        createdBy: options?.createdBy,
      });
      autoInviteQueued = auto.queued;
    } catch (err) {
      console.error("[participant-import] auto-invite failed", err);
    }
  }

  return { ...result, autoInviteQueued };
}
