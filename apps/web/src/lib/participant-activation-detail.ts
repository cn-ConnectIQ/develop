import {
  ParticipantInviteStatus,
  prisma,
} from "@connectiq/database";
import { normalizeInvitePhone } from "@/lib/invite/phone";

export type ParticipantActivationDetail = {
  participant: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    company: string | null;
    job_title: string | null;
    invite_status: string;
    checked_in_at: string | null;
  };
  activated: boolean;
  linked_user: boolean;
  activated_at: string | null;
  user: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    company: string | null;
    industry: string | null;
  } | null;
  contact_card: {
    wechat_qr_url: string | null;
    wechat_id: string | null;
    headline: string | null;
    show_phone: boolean;
    show_email: boolean;
    email: string | null;
  } | null;
  intent: {
    supply_tags: string[];
    demand_tags: string[];
    role: string | null;
    topics: string[];
    industry: string | null;
    region: string | null;
    raw_intent_text: string | null;
  } | null;
};

async function resolveLinkedUserId(
  eventId: string,
  participantId: string,
  phone: string | null,
  email: string | null,
): Promise<{ userId: string | null; activatedAt: Date | null }> {
  const inviteLink = await prisma.inviteRecord.findFirst({
    where: {
      participantId,
      userId: { not: null },
      campaign: { eventId },
    },
    orderBy: [{ activatedAt: "desc" }, { updatedAt: "desc" }],
    select: { userId: true, activatedAt: true },
  });
  if (inviteLink?.userId) {
    return {
      userId: inviteLink.userId,
      activatedAt: inviteLink.activatedAt,
    };
  }

  const or: Array<{ email?: string; phone?: string }> = [];
  if (email?.trim()) {
    or.push({ email: email.trim() });
  }
  if (phone?.trim()) {
    const raw = phone.trim();
    or.push({ phone: raw });
    const normalized = normalizeInvitePhone(raw);
    if (normalized && normalized !== raw) {
      or.push({ phone: normalized });
    }
  }
  if (or.length === 0) {
    return { userId: null, activatedAt: null };
  }

  const user = await prisma.user.findFirst({
    where: { OR: or },
    select: { id: true },
  });
  return { userId: user?.id ?? null, activatedAt: null };
}

export async function getParticipantActivationDetail(
  eventId: string,
  participantId: string,
): Promise<ParticipantActivationDetail | null> {
  const participant = await prisma.participant.findFirst({
    where: { id: participantId, eventId },
    include: {
      checkIns: {
        where: { eventId },
        take: 1,
        orderBy: { checkedInAt: "desc" },
      },
    },
  });
  if (!participant) return null;

  const { userId, activatedAt } = await resolveLinkedUserId(
    eventId,
    participantId,
    participant.phone,
    participant.email,
  );

  let user: ParticipantActivationDetail["user"] = null;
  let contactCard: ParticipantActivationDetail["contact_card"] = null;
  let intent: ParticipantActivationDetail["intent"] = null;

  if (userId) {
    const [userRow, cardRow, intentRow] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          profile: {
            select: { company: true, industry: true },
          },
        },
      }),
      prisma.contactCard.findUnique({ where: { userId } }),
      prisma.userEventIntent.findUnique({
        where: { userId_eventId: { userId, eventId } },
      }),
    ]);

    if (userRow) {
      user = {
        id: userRow.id,
        name: userRow.name,
        email: userRow.email,
        phone: userRow.phone,
        company: userRow.profile?.company ?? null,
        industry: userRow.profile?.industry ?? null,
      };
    }
    if (cardRow) {
      contactCard = {
        wechat_qr_url: cardRow.wechatQrUrl,
        wechat_id: cardRow.wechatId,
        headline: cardRow.headline,
        show_phone: cardRow.showPhone,
        show_email: cardRow.showEmail,
        email: cardRow.email,
      };
    }
    if (intentRow) {
      intent = {
        supply_tags: intentRow.supplyTags ?? [],
        demand_tags: intentRow.demandTags ?? [],
        role: intentRow.role,
        topics: intentRow.topics ?? [],
        industry: intentRow.industry,
        region: intentRow.region,
        raw_intent_text: intentRow.rawIntentText,
      };
    }
  }

  return {
    participant: {
      id: participant.id,
      name: participant.name,
      email: participant.email,
      phone: participant.phone,
      company: participant.company,
      job_title: participant.jobTitle,
      invite_status: participant.inviteStatus,
      checked_in_at:
        participant.checkIns[0]?.checkedInAt?.toISOString() ?? null,
    },
    activated: participant.inviteStatus === ParticipantInviteStatus.ACTIVATED,
    linked_user: Boolean(userId),
    activated_at: activatedAt?.toISOString() ?? null,
    user,
    contact_card: contactCard,
    intent,
  };
}
