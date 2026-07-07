import { ParticipantRole, type Participant } from "@connectiq/database";
import {
  isSpeakerTagged,
  isVipTagged,
  resolveDisplayTags,
} from "@/lib/participant-tags";

export function serializeParticipantRow(
  p: Participant & {
    checkIns?: { checkedInAt: Date }[];
    registrations?: Array<{
      ticketTypeId: string | null;
      ticketType: { id: string; name: string } | null;
    }>;
    _count?: { leads: number };
  },
  eventId: string,
) {
  const ticketType = p.registrations?.[0]?.ticketType?.name ?? null;
  const ticketTypeId = p.registrations?.[0]?.ticketTypeId ?? null;
  const tags = resolveDisplayTags(p.tags ?? [], p.role);
  const checkedIn = p.checkIns?.find(() => true);

  return {
    id: p.id,
    name: p.name,
    email: p.email,
    phone: p.phone,
    company: p.company,
    jobTitle: p.jobTitle,
    role: p.role,
    systemRole: p.systemRole,
    boothId: p.boothId,
    isBoothOwner: p.isBoothOwner,
    source: p.source,
    tags,
    badgeQr: p.badgeQr,
    createdAt: p.createdAt.toISOString(),
    ticketType,
    ticketTypeId,
    checkedInAt: checkedIn?.checkedInAt?.toISOString() ?? null,
    connectionCount: p._count?.leads ?? 0,
    isVip: isVipTagged(tags),
    isSpeaker: isSpeakerTagged(tags) || p.role === ParticipantRole.SPEAKER,
    inviteStatus: p.inviteStatus,
  };
}
