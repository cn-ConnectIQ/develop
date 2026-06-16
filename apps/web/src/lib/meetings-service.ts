import { MeetingStatus, prisma } from "@connectiq/database";
import { ErrorCode } from "@connectiq/types";
import { ApiError } from "@/lib/api-auth";

export type ApiMeetingStatus = MeetingStatus;

async function getMeetingForUser(meetingId: string, userId: string) {
  const meeting = await prisma.meeting.findUnique({
    where: { id: meetingId },
    include: {
      hostUser: { include: { profile: true } },
      guestUser: { include: { profile: true } },
      event: true,
    },
  });

  if (!meeting) {
    throw new ApiError("会面不存在", ErrorCode.NOT_FOUND, 404);
  }

  if (meeting.hostUserId !== userId && meeting.guestUserId !== userId) {
    throw new ApiError("无权操作此会面", ErrorCode.FORBIDDEN, 403);
  }

  return meeting;
}

export async function updateMeetingStatus(
  userId: string,
  meetingId: string,
  status: MeetingStatus,
  rating?: number,
) {
  const meeting = await getMeetingForUser(meetingId, userId);

  const allowed: Partial<Record<MeetingStatus, MeetingStatus[]>> = {
    [MeetingStatus.CONFIRMED]: [MeetingStatus.COMPLETED, MeetingStatus.NO_SHOW],
    [MeetingStatus.PENDING]: [MeetingStatus.DECLINED],
  };

  const allowedNext = allowed[meeting.status] ?? [];
  if (!allowedNext.includes(status)) {
    throw new ApiError("当前状态不可变更", ErrorCode.BAD_REQUEST, 400);
  }

  return prisma.meeting.update({
    where: { id: meetingId },
    data: {
      status,
      rating: status === MeetingStatus.COMPLETED ? rating ?? meeting.rating : meeting.rating,
    },
  });
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
    meeting.status !== MeetingStatus.CONFIRMED
  ) {
    throw new ApiError("当前状态不可取消", ErrorCode.BAD_REQUEST, 400);
  }

  const otherUserId =
    meeting.hostUserId === userId ? meeting.guestUserId : meeting.hostUserId;
  const canceller =
    meeting.hostUserId === userId ? meeting.hostUser : meeting.guestUser;

  const updated = await prisma.meeting.update({
    where: { id: meetingId },
    data: {
      status: MeetingStatus.CANCELLED,
      cancelReason: reason,
      cancelledById: userId,
      notifyOther,
    },
  });

  if (notifyOther) {
    const timeLabel = meeting.startsAt.toLocaleString("zh-CN", {
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
    startsAt: Date;
    endsAt: Date;
    cancelReason: string | null;
    cancelledById: string | null;
    updatedAt: Date;
    hostUserId: string;
    guestUserId: string;
    hostUser: { id: string; name: string; profile: { company: string | null } | null };
    guestUser: { id: string; name: string; profile: { company: string | null } | null };
  },
  currentUserId: string,
  seenCancelledIds: Set<string>,
) {
  const isHost = meeting.hostUserId === currentUserId;
  const counterparty = isHost ? meeting.guestUser : meeting.hostUser;
  const now = Date.now();
  const startsMs = meeting.startsAt.getTime();
  const endsMs = meeting.endsAt.getTime();
  const minutesUntil =
    startsMs > now ? Math.max(1, Math.ceil((startsMs - now) / 60000)) : undefined;
  const minutesOverdue =
    meeting.status === MeetingStatus.CONFIRMED && endsMs < now
      ? Math.max(1, Math.ceil((now - endsMs) / 60000))
      : undefined;

  const cancelledByOther =
    meeting.status === MeetingStatus.CANCELLED &&
    meeting.cancelledById != null &&
    meeting.cancelledById !== currentUserId;

  const newlyCancelled =
    meeting.status === MeetingStatus.CANCELLED &&
    cancelledByOther &&
    !seenCancelledIds.has(meeting.id) &&
    Date.now() - meeting.updatedAt.getTime() < 7 * 24 * 60 * 60 * 1000;

  return {
    id: meeting.id,
    type: "MEETING" as const,
    title: `与 ${counterparty.name} 的会面`,
    starts_at: meeting.startsAt.toISOString(),
    ends_at: meeting.endsAt.toISOString(),
    status: meeting.status,
    counterparty: {
      id: counterparty.id,
      name: counterparty.name,
      company: counterparty.profile?.company ?? undefined,
    },
    minutes_until: minutesUntil,
    minutes_overdue: minutesOverdue,
    cancelled_by_other: cancelledByOther,
    cancel_reason: meeting.cancelReason,
    newly_cancelled: newlyCancelled,
  };
}
