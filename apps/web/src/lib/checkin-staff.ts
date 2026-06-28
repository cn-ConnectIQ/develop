import { ParticipantRole, prisma } from "@connectiq/database";
import { ErrorCode } from "@connectiq/types";
import { ApiError } from "@/lib/api-auth";
import { maybeTriggerReferralScanOnCheckin } from "@/lib/ai/referral-scanner";
import { parseScanContent, resolveBadgeQr } from "@/lib/scan-parse";

export type StaffCheckinParticipant = {
  id: string;
  name: string;
  company: string | null;
  badge_qr: string | null;
  ticket_type: string;
  is_vip: boolean;
};

export type StaffCheckinResult = {
  participant: StaffCheckinParticipant;
  checked_in_at: string;
  already_checked_in: boolean;
};

function mapParticipant(
  participant: {
    id: string;
    name: string;
    company: string | null;
    badgeQr: string | null;
    role: ParticipantRole;
    registrations: Array<{ ticketType: { name: string } | null }>;
  },
  ticketType: string,
): StaffCheckinParticipant {
  const isVip = ticketType.toUpperCase().includes("VIP");
  return {
    id: participant.id,
    name: participant.name,
    company: participant.company,
    badge_qr: participant.badgeQr,
    ticket_type: ticketType,
    is_vip: isVip || participant.role === ParticipantRole.SPEAKER,
  };
}

/** 工作人员扫胸牌码签到（AD5） */
export async function performStaffBadgeCheckin(
  eventId: string,
  rawContent: string,
): Promise<StaffCheckinResult> {
  const parsed = parseScanContent(rawContent);
  const badgeQr = resolveBadgeQr(parsed);

  const participant = await prisma.participant.findFirst({
    where: {
      eventId,
      OR: [{ badgeQr }, { id: badgeQr }],
    },
    include: {
      registrations: {
        take: 1,
        orderBy: { registeredAt: "desc" },
        include: { ticketType: { select: { name: true } } },
      },
      checkIns: {
        where: { eventId },
        take: 1,
        orderBy: { checkedInAt: "desc" },
      },
    },
  });

  if (!participant) {
    throw new ApiError("未找到此参会者", ErrorCode.NOT_FOUND, 404);
  }

  const ticketType =
    participant.registrations[0]?.ticketType?.name ?? "普通票";
  const mapped = mapParticipant(participant, ticketType);

  const existing = participant.checkIns[0];
  if (existing) {
    return {
      participant: mapped,
      checked_in_at: existing.checkedInAt.toISOString(),
      already_checked_in: true,
    };
  }

  const checkIn = await prisma.checkIn.create({
    data: { eventId, participantId: participant.id, method: "scan" },
  });

  void maybeTriggerReferralScanOnCheckin(eventId).catch(() => {
    // 自动扫描失败不影响签到
  });

  return {
    participant: mapped,
    checked_in_at: checkIn.checkedInAt.toISOString(),
    already_checked_in: false,
  };
}
