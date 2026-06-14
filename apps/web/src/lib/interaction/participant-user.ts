import { prisma } from "@connectiq/database";

/** 通过邮箱/手机号将 User 关联到活动 Participant */
export async function findParticipantForUser(
  eventId: string,
  userId: string,
) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, phone: true, name: true },
  });
  if (!user) return null;

  const or: Array<{ email?: string; phone?: string }> = [];
  if (user.email) or.push({ email: user.email });
  if (user.phone) or.push({ phone: user.phone });
  if (or.length === 0) return null;

  return prisma.participant.findFirst({
    where: { eventId, OR: or },
  });
}

/** 确保用户在活动中有 Participant 记录（扫码轻量注册后自动创建） */
export async function ensureParticipantForUser(
  eventId: string,
  userId: string,
) {
  const existing = await findParticipantForUser(eventId, userId);
  if (existing) return existing;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true, phone: true },
  });
  if (!user) return null;

  return prisma.participant.create({
    data: {
      eventId,
      name: user.name ?? `用户${user.phone?.slice(-4) ?? ""}`,
      email: user.email ?? null,
      phone: user.phone ?? null,
    },
  });
}

export async function hasUserCheckedIn(eventId: string, userId: string) {
  const participant = await findParticipantForUser(eventId, userId);
  if (!participant) return false;

  const checkIn = await prisma.checkIn.findFirst({
    where: { eventId, participantId: participant.id },
    select: { id: true },
  });
  return Boolean(checkIn);
}

export async function hasUserPollParticipation(
  eventId: string,
  userId: string,
  pollId: string,
) {
  const participant = await findParticipantForUser(eventId, userId);
  if (!participant) return false;

  const response = await prisma.pollResponse.findFirst({
    where: { pollId, participantId: participant.id },
    select: { id: true },
  });
  return Boolean(response);
}
