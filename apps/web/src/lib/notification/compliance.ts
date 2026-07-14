import {
  OptOutScope,
  OptOutSource,
  OutboundChannel,
  prisma,
} from "@connectiq/database";
import { hashIdentityValue } from "@/lib/notification/crypto";
import {
  ACTIVATION_TEMPLATE_CODES,
  POST_EVENT_REPORT_CODES,
} from "@/lib/notification/types";

const SMS_LIMIT = 2;
const EMAIL_LIMIT = 3;

/** Asia/Shanghai 发送窗口 08:00–21:00 */
export function isWithinSendWindow(now = new Date()): boolean {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Shanghai",
    hour: "numeric",
    hour12: false,
  }).formatToParts(now);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  return hour >= 8 && hour < 21;
}

export async function isOptedOut(input: {
  identityType: "phone" | "email";
  identityValue: string;
  eventId?: string;
}): Promise<boolean> {
  const hash = hashIdentityValue(input.identityValue);
  const global = await prisma.optOutList.findFirst({
    where: {
      identityType: input.identityType,
      identityValueHash: hash,
      scope: OptOutScope.GLOBAL,
    },
  });
  if (global) return true;

  if (input.eventId) {
    const eventOpt = await prisma.optOutList.findFirst({
      where: {
        identityType: input.identityType,
        identityValueHash: hash,
        scope: OptOutScope.EVENT,
        eventId: input.eventId,
      },
    });
    if (eventOpt) return true;
  }
  return false;
}

export async function addOptOut(input: {
  identityType: "phone" | "email";
  identityValue: string;
  scope: "GLOBAL" | "EVENT";
  eventId?: string;
  source: "SMS_REPLY" | "EMAIL_LINK" | "MANUAL";
}) {
  const hash = hashIdentityValue(input.identityValue);
  const existing = await prisma.optOutList.findFirst({
    where: {
      identityType: input.identityType,
      identityValueHash: hash,
      scope: input.scope === "GLOBAL" ? OptOutScope.GLOBAL : OptOutScope.EVENT,
      eventId: input.scope === "EVENT" ? input.eventId : null,
    },
  });
  if (existing) return existing;

  return prisma.optOutList.create({
    data: {
      identityType: input.identityType,
      identityValueHash: hash,
      scope: input.scope === "GLOBAL" ? OptOutScope.GLOBAL : OptOutScope.EVENT,
      eventId: input.scope === "EVENT" ? input.eventId : undefined,
      source:
        input.source === "SMS_REPLY"
          ? OptOutSource.SMS_REPLY
          : input.source === "EMAIL_LINK"
            ? OptOutSource.EMAIL_LINK
            : OptOutSource.MANUAL,
    },
  });
}

export async function getQuotaCount(
  eventId: string,
  userId: string,
  channel: OutboundChannel,
): Promise<number> {
  const row = await prisma.notificationQuota.findUnique({
    where: {
      eventId_userId_channel: { eventId, userId, channel },
    },
  });
  return row?.count ?? 0;
}

export async function incrementQuota(
  eventId: string,
  userId: string,
  channel: OutboundChannel,
  by = 1,
) {
  await prisma.notificationQuota.upsert({
    where: {
      eventId_userId_channel: { eventId, userId, channel },
    },
    create: { eventId, userId, channel, count: by },
    update: { count: { increment: by } },
  });
}

export function quotaLimitFor(
  channel: OutboundChannel,
  templateCode: string,
): number | null {
  if (channel === OutboundChannel.SMS) return SMS_LIMIT;
  if (channel === OutboundChannel.EMAIL) {
    if (POST_EVENT_REPORT_CODES.has(templateCode)) return null;
    return EMAIL_LIMIT;
  }
  return null;
}

export async function assertUserWithinQuota(input: {
  eventId: string;
  userId: string;
  channel: OutboundChannel;
  templateCode: string;
}): Promise<{ ok: true } | { ok: false; reason: string }> {
  const limit = quotaLimitFor(input.channel, input.templateCode);
  if (limit == null) return { ok: true };
  const count = await getQuotaCount(input.eventId, input.userId, input.channel);
  if (count >= limit) {
    return {
      ok: false,
      reason:
        input.channel === OutboundChannel.SMS
          ? `已达短信单人单场上限（${limit} 条）`
          : `已达邮件单人单场上限（${limit} 封）`,
    };
  }
  return { ok: true };
}

export async function isUserActivatedOnEvent(
  eventId: string,
  userId: string,
): Promise<boolean> {
  const uec = await prisma.userEventCode.findFirst({
    where: { eventId, userId },
    select: { id: true },
  });
  if (uec) return true;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { phone: true, email: true },
  });
  if (!user) return false;

  const activated = await prisma.participant.findFirst({
    where: {
      eventId,
      inviteStatus: "ACTIVATED",
      OR: [
        ...(user.phone ? [{ phone: user.phone }] : []),
        ...(user.email ? [{ email: user.email }] : []),
      ],
    },
    select: { id: true },
  });
  return Boolean(activated);
}

export function isActivationTemplate(code: string) {
  return ACTIVATION_TEMPLATE_CODES.has(code);
}
