import { ScanResult, prisma } from "@connectiq/database";
import {
  ensureParticipantForUser,
  findParticipantForUser,
} from "@/lib/interaction/participant-user";
import type { ScanHandlerContext, ScanHandlerOutcome } from "@/lib/scan/types";

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: string }).code === "P2002"
  );
}

function formatCheckinTime(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export async function handleCheckinScan(
  ctx: ScanHandlerContext,
): Promise<ScanHandlerOutcome> {
  let participant = await findParticipantForUser(
    ctx.eventId,
    ctx.attendeeUserId,
  );
  if (!participant) {
    participant = await ensureParticipantForUser(
      ctx.eventId,
      ctx.attendeeUserId,
    );
  }
  if (!participant) {
    return {
      result: ScanResult.INVALID,
      message: "无法识别参会者身份",
    };
  }

  const existing = await prisma.checkIn.findFirst({
    where: { eventId: ctx.eventId, participantId: participant.id },
    orderBy: { checkedInAt: "asc" },
    select: { checkedInAt: true },
  });

  if (existing) {
    return {
      result: ScanResult.DUPLICATE,
      message: `已于 ${formatCheckinTime(existing.checkedInAt)} 签到`,
      actionDetail: {
        checkedInAt: existing.checkedInAt.toISOString(),
        isVip: ctx.participant.tags.includes("VIP"),
      },
    };
  }

  try {
    const checkIn = await prisma.checkIn.create({
      data: {
        eventId: ctx.eventId,
        participantId: participant.id,
        method: "scan",
      },
    });

    const isVip = ctx.participant.tags.includes("VIP");

    return {
      result: ScanResult.SUCCESS,
      message: isVip ? "⭐ VIP 嘉宾签到成功" : "签到成功",
      actionDetail: {
        checkedInAt: checkIn.checkedInAt.toISOString(),
        isVip,
      },
    };
  } catch (err) {
    if (isUniqueViolation(err)) {
      const dup = await prisma.checkIn.findFirst({
        where: { eventId: ctx.eventId, participantId: participant.id },
        orderBy: { checkedInAt: "asc" },
        select: { checkedInAt: true },
      });
      return {
        result: ScanResult.DUPLICATE,
        message: dup
          ? `已于 ${formatCheckinTime(dup.checkedInAt)} 签到`
          : "该参会者已签到",
        actionDetail: {
          checkedInAt: dup?.checkedInAt.toISOString() ?? null,
          isVip: ctx.participant.tags.includes("VIP"),
        },
      };
    }
    throw err;
  }
}
