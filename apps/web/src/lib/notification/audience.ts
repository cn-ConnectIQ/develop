import {
  ParticipantInviteStatus,
  ParticipantRole,
  SystemRole,
  prisma,
} from "@connectiq/database";
import type { AudienceFilter } from "@/lib/notification/types";

export type AudienceMember = {
  userId: string | null;
  participantId: string;
  name: string;
  phone: string | null;
  email: string | null;
  company: string | null;
};

/**
 * 强制限定在本活动；调用方须已校验 event.orgId，避免跨主办方名单。
 */
export async function resolveAudienceMembers(
  eventId: string,
  filter: AudienceFilter,
  options?: { limit?: number },
): Promise<AudienceMember[]> {
  const take = options?.limit;
  const where: Record<string, unknown> = { eventId };

  switch (filter.type) {
    case "all_attendees":
      where.systemRole = SystemRole.PARTICIPANT;
      break;
    case "not_activated":
      where.systemRole = SystemRole.PARTICIPANT;
      where.inviteStatus = { not: ParticipantInviteStatus.ACTIVATED };
      break;
    case "activated_no_intent":
      where.systemRole = SystemRole.PARTICIPANT;
      where.inviteStatus = ParticipantInviteStatus.ACTIVATED;
      break;
    case "all_exhibitors":
      where.systemRole = SystemRole.EXHIBITOR;
      break;
    case "booth":
      where.systemRole = SystemRole.EXHIBITOR;
      if (filter.booth_id) where.boothId = filter.booth_id;
      break;
    case "vip":
      where.OR = [
        { tags: { has: "VIP" } },
        { tags: { has: "vip" } },
        { role: ParticipantRole.SPEAKER },
      ];
      break;
    case "custom":
      where.systemRole = SystemRole.PARTICIPANT;
      if (filter.source) where.source = filter.source;
      if (filter.title) {
        where.jobTitle = { contains: filter.title, mode: "insensitive" };
      }
      if (filter.booth_id) where.boothId = filter.booth_id;
      break;
    default:
      break;
  }

  const participants = await prisma.participant.findMany({
    where,
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      company: true,
      inviteStatus: true,
    },
    take,
    orderBy: { createdAt: "desc" },
  });

  const phones = participants.map((p) => p.phone).filter(Boolean) as string[];
  const emails = participants
    .map((p) => p.email?.toLowerCase())
    .filter(Boolean) as string[];

  const [usersByPhone, usersByEmail, inviteLinks] = await Promise.all([
    phones.length
      ? prisma.user.findMany({
          where: { phone: { in: phones } },
          select: { id: true, phone: true },
        })
      : Promise.resolve([]),
    emails.length
      ? prisma.user.findMany({
          where: { email: { in: emails } },
          select: { id: true, email: true },
        })
      : Promise.resolve([]),
    prisma.inviteRecord.findMany({
      where: {
        participantId: { in: participants.map((p) => p.id) },
        userId: { not: null },
      },
      select: { participantId: true, userId: true },
      distinct: ["participantId"],
    }),
  ]);

  const phoneMap = new Map(usersByPhone.map((u) => [u.phone!, u.id]));
  const emailMap = new Map(
    usersByEmail.map((u) => [u.email.toLowerCase(), u.id]),
  );
  const inviteMap = new Map(
    inviteLinks.map((r) => [r.participantId, r.userId!]),
  );

  let members: AudienceMember[] = participants.map((p) => {
    const userId =
      inviteMap.get(p.id) ??
      (p.phone ? phoneMap.get(p.phone) : undefined) ??
      (p.email ? emailMap.get(p.email.toLowerCase()) : undefined) ??
      null;
    return {
      userId,
      participantId: p.id,
      name: p.name,
      phone: p.phone,
      email: p.email,
      company: p.company,
    };
  });

  if (filter.type === "activated_no_intent") {
    const withUser = members.filter((m) => m.userId);
    const userIds = withUser.map((m) => m.userId!);
    const intents = await prisma.userEventIntent.findMany({
      where: { eventId, userId: { in: userIds } },
      select: { userId: true },
    });
    const hasIntent = new Set(intents.map((i) => i.userId));
    members = withUser.filter((m) => !hasIntent.has(m.userId!));
  }

  const seen = new Set<string>();
  const deduped: AudienceMember[] = [];
  for (const m of members) {
    const key = m.userId ?? `p:${m.participantId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(m);
  }

  return deduped;
}

export async function countActivatedParticipants(eventId: string) {
  return prisma.participant.count({
    where: {
      eventId,
      inviteStatus: ParticipantInviteStatus.ACTIVATED,
    },
  });
}
