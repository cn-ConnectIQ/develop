import { InviteChannel, prisma, type Prisma } from "@connectiq/database";

function normalizeDestination(value: string) {
  return value.trim().toLowerCase();
}

/** 是否在退订/黑名单中（事件级或组织级；channel 匹配或全渠道） */
export async function isInviteDestinationBlocked(input: {
  destination: string;
  channel: InviteChannel;
  eventId?: string | null;
  orgId?: string | null;
}): Promise<boolean> {
  const destination = normalizeDestination(input.destination);
  if (!destination) return false;

  const scopeOr: Prisma.InviteContactBlockWhereInput[] = [];
  if (input.eventId) {
    scopeOr.push({ eventId: input.eventId });
  }
  if (input.orgId) {
    scopeOr.push({ orgId: input.orgId });
  }
  if (scopeOr.length === 0) return false;

  const hit = await prisma.inviteContactBlock.findFirst({
    where: {
      destination,
      AND: [
        { OR: [{ channel: input.channel }, { channel: null }] },
        { OR: scopeOr },
      ],
    },
    select: { id: true },
  });
  return Boolean(hit);
}

export async function upsertInviteBlock(input: {
  destination: string;
  channel?: InviteChannel | null;
  eventId?: string | null;
  orgId?: string | null;
  reason?: string;
  note?: string | null;
}) {
  const destination = normalizeDestination(input.destination);
  if (!destination) return null;

  const channel = input.channel ?? null;
  const eventId = input.eventId ?? null;
  const existing = await prisma.inviteContactBlock.findFirst({
    where: { destination, channel, eventId },
  });
  if (existing) {
    return prisma.inviteContactBlock.update({
      where: { id: existing.id },
      data: {
        reason: input.reason ?? "BLACKLIST",
        note: input.note ?? null,
        orgId: input.orgId ?? existing.orgId,
      },
    });
  }
  return prisma.inviteContactBlock.create({
    data: {
      destination,
      channel,
      eventId,
      orgId: input.orgId ?? null,
      reason: input.reason ?? "BLACKLIST",
      note: input.note ?? null,
    },
  });
}

/** 营销短信合规后缀（已含则不重复追加） */
export function appendMarketingSmsSuffix(message: string) {
  const suffix = "拒收请回复R";
  if (message.includes(suffix) || message.includes("拒收请回复")) {
    return message;
  }
  return `${message.trim()} ${suffix}`;
}
