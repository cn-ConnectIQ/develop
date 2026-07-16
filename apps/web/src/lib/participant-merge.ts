import {
  ParticipantSource,
  SystemRole,
  ParticipantRole,
  prisma,
  type Participant,
  type Prisma,
} from "@connectiq/database";
import { generateBadgeQr } from "@/lib/participants";
import {
  mergeParticipantTags,
  normalizeParticipantTags,
} from "@/lib/participant-tags";

export type ParticipantUpsertInput = {
  name: string;
  phone?: string | null;
  email?: string | null;
  company?: string | null;
  jobTitle?: string | null;
  tags?: string[];
  source?: ParticipantSource;
  systemRole?: SystemRole;
  role?: ParticipantRole;
};

export type ParticipantMergeResult = {
  participant: Participant;
  created: boolean;
  merged: boolean;
};

function normalizePhone(phone: string | null | undefined): string | null {
  const trimmed = phone?.trim();
  return trimmed || null;
}

function normalizeEmail(email: string | null | undefined): string | null {
  const trimmed = email?.trim();
  return trimmed || null;
}

function mergeSource(
  existing: ParticipantSource,
  incoming: ParticipantSource,
): ParticipantSource {
  if (existing === incoming) return existing;
  const priority: ParticipantSource[] = [
    ParticipantSource.IMPORT,
    ParticipantSource.INVITE,
    ParticipantSource.SELF_REGISTER,
    ParticipantSource.SCAN,
  ];
  const existingIdx = priority.indexOf(existing);
  const incomingIdx = priority.indexOf(incoming);
  return existingIdx <= incomingIdx ? existing : incoming;
}

export async function findParticipantByPhone(
  eventId: string,
  phone: string | null | undefined,
) {
  const normalized = normalizePhone(phone);
  if (!normalized) return null;
  return prisma.participant.findFirst({
    where: { eventId, phone: normalized },
  });
}

export async function mergeParticipantByPhone(
  eventId: string,
  input: ParticipantUpsertInput,
  options?: { skipDuplicateUpdate?: boolean },
): Promise<ParticipantMergeResult> {
  const phone = normalizePhone(input.phone);
  const email = normalizeEmail(input.email);
  const incomingTags = normalizeParticipantTags(input.tags);
  const source = input.source ?? ParticipantSource.SCAN;

  if (!phone) {
    const created = await prisma.participant.create({
      data: {
        eventId,
        name: input.name.trim(),
        phone: null,
        email,
        company: input.company ?? null,
        jobTitle: input.jobTitle ?? null,
        tags: incomingTags,
        source,
        systemRole: input.systemRole ?? SystemRole.PARTICIPANT,
        role: input.role ?? ParticipantRole.ATTENDEE,
        badgeQr: generateBadgeQr(eventId),
      },
    });
    return { participant: created, created: true, merged: false };
  }

  const existing = await findParticipantByPhone(eventId, phone);

  if (!existing) {
    const created = await prisma.participant.create({
      data: {
        eventId,
        name: input.name.trim(),
        phone,
        email,
        company: input.company ?? null,
        jobTitle: input.jobTitle ?? null,
        tags: incomingTags,
        source,
        systemRole: input.systemRole ?? SystemRole.PARTICIPANT,
        role: input.role ?? ParticipantRole.ATTENDEE,
        badgeQr: generateBadgeQr(eventId),
      },
    });
    return { participant: created, created: true, merged: false };
  }

  if (options?.skipDuplicateUpdate) {
    return { participant: existing, created: false, merged: false };
  }

  const mergedTags = mergeParticipantTags(existing.tags, incomingTags);
  const updateData: Prisma.ParticipantUpdateInput = {
    name: input.name.trim() || existing.name,
    tags: mergedTags,
    source: mergeSource(existing.source, source),
    badgeQr: existing.badgeQr ?? generateBadgeQr(eventId),
  };

  if (email) updateData.email = email;
  if (input.company) updateData.company = input.company;
  if (input.jobTitle) updateData.jobTitle = input.jobTitle;
  if (input.systemRole) updateData.systemRole = input.systemRole;
  if (input.role) updateData.role = input.role;

  const participant = await prisma.participant.update({
    where: { id: existing.id },
    data: updateData,
  });

  return {
    participant,
    created: false,
    merged: mergedTags.length > existing.tags.length || source !== existing.source,
  };
}

export async function upsertParticipantsFromRowsWithMerge(
  eventId: string,
  rows: Array<ParticipantUpsertInput & { name: string }>,
  options?: { skipDuplicates?: boolean },
) {
  let created = 0;
  let updated = 0;
  let skipped = 0;
  let merged = 0;
  const createdIds: string[] = [];

  for (const row of rows) {
    if (!row.phone?.trim()) {
      skipped++;
      continue;
    }

    const result = await mergeParticipantByPhone(
      eventId,
      {
        ...row,
        source: ParticipantSource.IMPORT,
      },
      { skipDuplicateUpdate: options?.skipDuplicates },
    );

    if (result.created) {
      created++;
      createdIds.push(result.participant.id);
    } else if (options?.skipDuplicates) skipped++;
    else {
      updated++;
      if (result.merged) merged++;
    }
  }

  return { created, updated, skipped, merged, createdIds };
}
