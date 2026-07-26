import { prisma, ParticipantSource, RegistrationStatus } from "@connectiq/database";
import { mergeParticipantByPhone } from "@/lib/participant-merge";
import { maybeAutoInviteNewParticipants } from "@/lib/invite/send-fixed-invites";
import { recordTrialSignal } from "@/lib/organizer-trial-service";
import type { PartnerRegistrationRow } from "@/lib/partner-sync/types";

export type PartnerRegistrationSyncResult = {
  fetched: number;
  created: number;
  updated: number;
  cancelled: number;
  skippedRows: number;
};

function mapExternalStatus(status: string | null | undefined): RegistrationStatus {
  const normalized = (status ?? "").trim().toLowerCase();
  if (normalized.includes("cancel")) return RegistrationStatus.CANCELLED;
  if (normalized.includes("pending") || normalized.includes("wait")) {
    return RegistrationStatus.PENDING;
  }
  return RegistrationStatus.CONFIRMED;
}

/**
 * 把伙伴渠道拉取到的报名行落库为 Participant + ParticipantRegistration。
 * 有 externalId 时按 (provider, externalId) 做幂等匹配/更新；没有则退回按手机号匹配（兼容无稳定 ID 的渠道）。
 */
export async function syncParticipantRegistrations(
  eventId: string,
  provider: string,
  rows: PartnerRegistrationRow[],
): Promise<PartnerRegistrationSyncResult> {
  let created = 0;
  let updated = 0;
  let cancelled = 0;
  let skippedRows = 0;
  const createdIds: string[] = [];
  const now = new Date();

  for (const row of rows) {
    const phone = row.phone?.trim();
    const name = row.name?.trim();
    if (!phone || !name) {
      skippedRows++;
      continue;
    }

    const externalId = row.externalId?.trim() || null;
    const status = mapExternalStatus(row.externalStatus);

    const existingReg = externalId
      ? await prisma.participantRegistration.findUnique({
          where: { provider_externalId: { provider, externalId } },
        })
      : null;

    if (existingReg) {
      await prisma.$transaction([
        prisma.participant.update({
          where: { id: existingReg.participantId },
          data: {
            name,
            ...(row.email?.trim() ? { email: row.email.trim() } : {}),
            ...(row.company?.trim() ? { company: row.company.trim() } : {}),
            ...(row.jobTitle?.trim() ? { jobTitle: row.jobTitle.trim() } : {}),
          },
        }),
        prisma.participantRegistration.update({
          where: { id: existingReg.id },
          data: {
            status,
            externalStatus: row.externalStatus ?? null,
            syncedAt: now,
          },
        }),
      ]);

      if (
        status === RegistrationStatus.CANCELLED &&
        existingReg.status !== RegistrationStatus.CANCELLED
      ) {
        cancelled++;
      } else {
        updated++;
      }
      continue;
    }

    const merge = await mergeParticipantByPhone(eventId, {
      name,
      phone,
      email: row.email,
      company: row.company,
      jobTitle: row.jobTitle,
      source: ParticipantSource.IMPORT,
    });

    if (externalId) {
      await prisma.participantRegistration.create({
        data: {
          participantId: merge.participant.id,
          provider,
          externalId,
          externalStatus: row.externalStatus ?? null,
          status,
          syncedAt: now,
        },
      });
    }

    if (merge.created) {
      created++;
      createdIds.push(merge.participant.id);
    } else {
      updated++;
    }
  }

  const totalWritten = created + updated;
  if (totalWritten > 0) {
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { orgId: true },
    });
    if (event?.orgId) {
      void recordTrialSignal(event.orgId, "participants_imported", {
        eventId,
        count: totalWritten,
      });
    }
  }

  if (createdIds.length > 0) {
    try {
      await maybeAutoInviteNewParticipants({ eventId, participantIds: createdIds });
    } catch (err) {
      console.error("[partner-sync] auto-invite failed", err);
    }
  }

  return { fetched: rows.length, created, updated, cancelled, skippedRows };
}
