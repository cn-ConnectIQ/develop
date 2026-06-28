import { MeetingStatus, SignalType, prisma } from "@connectiq/database";
import { ErrorCode } from "@connectiq/types";
import { ApiError } from "@/lib/api-auth";
import { tryAutoScheduleMeeting } from "@/lib/meetings/auto-scheduler";
import { recordSignal } from "@/lib/signals";
import {
  MatchFeedbackSignal,
  trackMatchFeedback,
} from "@/lib/ai/matching/match-feedback-service";

export type ApiMeetingStatus = MeetingStatus;

async function getMeetingForUser(meetingId: string, userId: string) {
  const meeting = await prisma.meeting.findUnique({
    where: { id: meetingId },
    include: {
      requester: { include: { profile: true } },
      recipient: { include: { profile: true } },
      event: true,
    },
  });

  if (!meeting) {
    throw new ApiError("会面不存在", ErrorCode.NOT_FOUND, 404);
  }

  if (meeting.requesterId !== userId && meeting.recipientId !== userId) {
    throw new ApiError("无权操作此会面", ErrorCode.FORBIDDEN, 403);
  }

  return meeting;
}

export async function updateMeetingStatus(
  userId: string,
  meetingId: string,
  status: MeetingStatus,
) {
  const meeting = await getMeetingForUser(meetingId, userId);

  const allowed: Partial<Record<MeetingStatus, MeetingStatus[]>> = {
    [MeetingStatus.ACCEPTED]: [MeetingStatus.COMPLETED, MeetingStatus.NO_SHOW],
    [MeetingStatus.PENDING]: [MeetingStatus.DECLINED, MeetingStatus.ACCEPTED],
  };

  const allowedNext = allowed[meeting.status] ?? [];
  if (!allowedNext.includes(status)) {
    throw new ApiError("当前状态不可变更", ErrorCode.VALIDATION_ERROR, 400);
  }

  const updated = await prisma.meeting.update({
    where: { id: meetingId },
    data: {
      status,
      respondedAt: new Date(),
    },
  });

  if (status === MeetingStatus.ACCEPTED && meeting.status === MeetingStatus.PENDING) {
    const scheduleResult = await tryAutoScheduleMeeting(meetingId);
    const scheduled = scheduleResult.ok
      ? await prisma.meeting.findUnique({ where: { id: meetingId } })
      : updated;

    const startIso = scheduled?.scheduledStart?.toISOString();
    if (startIso) {
      for (const uid of [meeting.requesterId, meeting.recipientId]) {
        recordSignal(uid, meeting.eventId, SignalType.MEETING_BOOKED, meetingId, "MEETING", {
          starts_at: startIso,
        });
      }
    }
    return scheduled ?? updated;
  }

  return updated;
}

export async function submitMeetingRating(
  userId: string,
  meetingId: string,
  rating: number,
  comment?: string,
) {
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new ApiError("评分须为 1–5 的整数", ErrorCode.VALIDATION_ERROR, 400);
  }

  const meeting = await getMeetingForUser(meetingId, userId);

  const rateableStatuses: MeetingStatus[] = [
    MeetingStatus.COMPLETED,
    MeetingStatus.ACCEPTED,
    MeetingStatus.NO_SHOW,
  ];
  if (!rateableStatuses.includes(meeting.status)) {
    throw new ApiError("当前会面状态不可评分", ErrorCode.VALIDATION_ERROR, 400);
  }

  if (
    meeting.status === MeetingStatus.ACCEPTED &&
    meeting.scheduledEnd &&
    meeting.scheduledEnd.getTime() > Date.now()
  ) {
    throw new ApiError("会面尚未结束，暂不可评分", ErrorCode.VALIDATION_ERROR, 400);
  }

  const isRequester = meeting.requesterId === userId;
  const existingRating = isRequester ? meeting.requesterRating : meeting.recipientRating;
  if (existingRating != null) {
    throw new ApiError("您已提交过评分", ErrorCode.VALIDATION_ERROR, 400);
  }

  const trimmedComment = comment?.trim() || null;
  const updated = await prisma.meeting.update({
    where: { id: meetingId },
    data: isRequester
      ? {
          requesterRating: rating,
          requesterRatingComment: trimmedComment,
        }
      : {
          recipientRating: rating,
          recipientRatingComment: trimmedComment,
        },
  });

  trackMatchFeedback({
    viewerId: userId,
    targetId: isRequester ? meeting.recipientId : meeting.requesterId,
    eventId: meeting.eventId,
    signal: MatchFeedbackSignal.MEETING,
    matchScore: meeting.aiMatchScore ?? undefined,
  });

  return {
    id: updated.id,
    rating,
    comment: trimmedComment,
    role: isRequester ? ("requester" as const) : ("recipient" as const),
  };
}

export async function bookMeeting(input: {
  eventId: string;
  requesterId: string;
  recipientId: string;
  startsAt: Date;
  endsAt: Date;
  message?: string;
  fromAiMatch?: boolean;
  aiMatchScore?: number;
}) {
  if (input.requesterId === input.recipientId) {
    throw new ApiError("不能与自己预约", ErrorCode.VALIDATION_ERROR, 400);
  }

  if (input.endsAt <= input.startsAt) {
    throw new ApiError("结束时间须晚于开始时间", ErrorCode.VALIDATION_ERROR, 400);
  }

  const meeting = await prisma.meeting.create({
    data: {
      eventId: input.eventId,
      requesterId: input.requesterId,
      recipientId: input.recipientId,
      status: MeetingStatus.ACCEPTED,
      scheduledStart: input.startsAt,
      scheduledEnd: input.endsAt,
      message: input.message,
      fromAiMatch: input.fromAiMatch ?? false,
      aiMatchScore: input.aiMatchScore,
      respondedAt: new Date(),
    },
  });

  await tryAutoScheduleMeeting(meeting.id);
  const scheduled = await prisma.meeting.findUnique({ where: { id: meeting.id } });
  const finalMeeting = scheduled ?? meeting;

  const startIso = finalMeeting.scheduledStart?.toISOString() ?? input.startsAt.toISOString();
  for (const uid of [input.requesterId, input.recipientId]) {
    recordSignal(uid, input.eventId, SignalType.MEETING_BOOKED, meeting.id, "MEETING", {
      starts_at: startIso,
    });
  }

  const [requester, event] = await Promise.all([
    prisma.user.findUnique({
      where: { id: input.requesterId },
      select: { name: true },
    }),
    prisma.event.findUnique({
      where: { id: input.eventId },
      select: { name: true },
    }),
  ]);
  if (requester && event) {
    const { sendMeetingInviteSubscribe } = await import("@/lib/wechat/subscribe-message");
    void sendMeetingInviteSubscribe({
      toUserId: input.recipientId,
      requesterName: requester.name,
      eventName: event.name,
      scheduledAt: finalMeeting.scheduledStart ?? input.startsAt,
      meetingId: finalMeeting.id,
    });
  }

  trackMatchFeedback({
    viewerId: input.requesterId,
    targetId: input.recipientId,
    eventId: input.eventId,
    signal: MatchFeedbackSignal.MEETING,
    matchScore: input.aiMatchScore ?? undefined,
  });

  return finalMeeting;
}

export async function cancelMeeting(
  userId: string,
  meetingId: string,
  reason: string,
  notifyOther: boolean,
) {
  const meeting = await getMeetingForUser(meetingId, userId);

  if (
    meeting.status !== MeetingStatus.PENDING &&
    meeting.status !== MeetingStatus.ACCEPTED
  ) {
    throw new ApiError("当前状态不可取消", ErrorCode.VALIDATION_ERROR, 400);
  }

  const otherUserId =
    meeting.requesterId === userId ? meeting.recipientId : meeting.requesterId;
  const canceller =
    meeting.requesterId === userId ? meeting.requester : meeting.recipient;

  const updated = await prisma.meeting.update({
    where: { id: meetingId },
    data: {
      status: MeetingStatus.CANCELLED,
      message: reason,
      respondedAt: new Date(),
    },
  });

  if (notifyOther && meeting.scheduledStart) {
    const timeLabel = meeting.scheduledStart.toLocaleString("zh-CN", {
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    await prisma.notification.create({
      data: {
        userId: otherUserId,
        title: "会面已取消",
        body: `${canceller.name} 取消了 ${timeLabel} 的会面预约`,
      },
    });
  }

  return updated;
}

export function mapMeetingToScheduleItem(
  meeting: {
    id: string;
    status: MeetingStatus;
    scheduledStart: Date | null;
    scheduledEnd: Date | null;
    message: string | null;
    requesterId: string;
    recipientId: string;
    requester: { id: string; name: string; profile: { company: string | null } | null };
    recipient: { id: string; name: string; profile: { company: string | null } | null };
  },
  currentUserId: string,
  seenCancelledIds: Set<string>,
) {
  const isRequester = meeting.requesterId === currentUserId;
  const counterparty = isRequester ? meeting.recipient : meeting.requester;
  const now = Date.now();
  const startsMs = meeting.scheduledStart?.getTime() ?? now;
  const endsMs = meeting.scheduledEnd?.getTime() ?? startsMs;
  const minutesUntil =
    meeting.scheduledStart && startsMs > now
      ? Math.max(1, Math.ceil((startsMs - now) / 60000))
      : undefined;
  const minutesOverdue =
    meeting.status === MeetingStatus.ACCEPTED && meeting.scheduledEnd && endsMs < now
      ? Math.max(1, Math.ceil((now - endsMs) / 60000))
      : undefined;

  const cancelledByOther = meeting.status === MeetingStatus.CANCELLED && !isRequester;

  const newlyCancelled =
    meeting.status === MeetingStatus.CANCELLED &&
    cancelledByOther &&
    !seenCancelledIds.has(meeting.id);

  return {
    id: meeting.id,
    type: "MEETING" as const,
    title: `与 ${counterparty.name} 的会面`,
    starts_at: meeting.scheduledStart?.toISOString() ?? new Date().toISOString(),
    ends_at: meeting.scheduledEnd?.toISOString() ?? new Date().toISOString(),
    status: meeting.status,
    counterparty: {
      id: counterparty.id,
      name: counterparty.name,
      company: counterparty.profile?.company ?? undefined,
    },
    minutes_until: minutesUntil,
    minutes_overdue: minutesOverdue,
    cancelled_by_other: cancelledByOther,
    cancel_reason: meeting.status === MeetingStatus.CANCELLED ? meeting.message : null,
    newly_cancelled: newlyCancelled,
  };
}
