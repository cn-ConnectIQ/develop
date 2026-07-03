import { prisma } from "@connectiq/database";
import { ErrorCode } from "@connectiq/types";
import { ApiError } from "@/lib/api-auth";
import { getHomeStampProgress } from "@/lib/event-home-discovery-service";
import { findParticipantForUser } from "@/lib/interaction/participant-user";
import { formatEventCodeForScan } from "@/lib/event-code";
import { upsertUserEventCode } from "@/lib/lottery/redemption";

export type ApiMyCodeSummary = {
  checkedIn: boolean;
  stampProgress: string;
  pendingPrizes: number;
};

export type ApiMyCodeResponse = {
  code: string;
  summary: ApiMyCodeSummary;
};

/** 参会者「我的码」：一码通 + 状态摘要 */
export async function getMyAttendeeCode(
  userId: string,
  eventId: string,
): Promise<ApiMyCodeResponse> {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true },
  });
  if (!event) {
    throw new ApiError("活动不存在", ErrorCode.NOT_FOUND, 404);
  }

  const [eventCode, participant, stampProgress, pendingPrizes] =
    await Promise.all([
      upsertUserEventCode(userId, eventId),
      findParticipantForUser(eventId, userId),
      getHomeStampProgress(eventId, userId).catch(() => ({
        stamped_count: 0,
        required_count: 0,
      })),
      prisma.lotteryWinner.count({
        where: {
          userId,
          verified: false,
          lottery: { eventId },
        },
      }),
    ]);

  let checkedIn = false;
  if (participant) {
    const checkIn = await prisma.checkIn.findFirst({
      where: { eventId, participantId: participant.id },
      select: { id: true },
    });
    checkedIn = Boolean(checkIn);
  }

  const stamped = stampProgress.stamped_count ?? 0;
  const required = stampProgress.required_count ?? 0;
  const stampProgressText =
    required > 0 ? `${stamped}/${required}` : stamped > 0 ? `${stamped}/—` : "0/0";

  return {
    code: formatEventCodeForScan(eventCode.code),
    summary: {
      checkedIn,
      stampProgress: stampProgressText,
      pendingPrizes,
    },
  };
}
