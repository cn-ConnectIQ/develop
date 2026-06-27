import { MeetingStatus, prisma } from "@connectiq/database";
import { ErrorCode } from "@connectiq/types";
import { ApiError } from "@/lib/api-auth";
import {
  generateSlotCandidates,
  intervalsOverlap,
  resolveScheduleBaseDate,
} from "@/lib/meetings/auto-scheduler";
import {
  MEETING_TIME_WINDOWS_KEY,
  type MeetingTimeWindow,
} from "@/lib/meeting-config-service";

const DEFAULT_WINDOWS: MeetingTimeWindow[] = [
  { start: "10:00", end: "12:00" },
  { start: "14:00", end: "17:00" },
];

export type ApiMobileMeetingListItem = {
  id: string;
  event_id: string;
  event_name?: string;
  status: MeetingStatus;
  counterparty: {
    id: string;
    name: string;
    company?: string;
    title?: string;
    avatar_url?: string;
  };
  starts_at: string;
  ends_at: string;
  table_number?: string;
  venue_label?: string;
  is_incoming?: boolean;
  wechat_exchanged?: boolean;
  match_score?: number;
  ai_recommend_reason?: string;
};

export type ApiMeetingTimeSlot = {
  id: string;
  starts_at: string;
  ends_at: string;
  label: string;
  time_label: string;
  status: "available" | "occupied" | "mutual_free";
};

async function loadWindows(eventId: string): Promise<MeetingTimeWindow[]> {
  const row = await prisma.eventSetting.findUnique({
    where: { eventId_key: { eventId, key: MEETING_TIME_WINDOWS_KEY } },
  });
  if (!row?.value || !Array.isArray(row.value)) return DEFAULT_WINDOWS;
  const windows = (row.value as MeetingTimeWindow[]).filter(
    (w) => typeof w.start === "string" && typeof w.end === "string",
  );
  return windows.length > 0 ? windows : DEFAULT_WINDOWS;
}

function formatTimeLabel(d: Date): string {
  return d.toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function mapCounterparty(
  user: {
    id: string;
    name: string;
    profile: { company: string | null } | null;
  },
) {
  return {
    id: user.id,
    name: user.name,
    company: user.profile?.company ?? undefined,
  };
}

function mapMeetingListItem(
  meeting: {
    id: string;
    eventId: string;
    status: MeetingStatus;
    scheduledStart: Date | null;
    scheduledEnd: Date | null;
    requesterId: string;
    recipientId: string;
    wechatExchanged: boolean;
    aiMatchScore: number | null;
    message: string | null;
    fromAiMatch: boolean;
    event: { name: string };
    requester: {
      id: string;
      name: string;
      profile: { company: string | null } | null;
    };
    recipient: {
      id: string;
      name: string;
      profile: { company: string | null } | null;
    };
    table: { name: string; area: { name: string } } | null;
  },
  viewerId: string,
): ApiMobileMeetingListItem {
  const isRequester = meeting.requesterId === viewerId;
  const counterpartyUser = isRequester ? meeting.recipient : meeting.requester;
  const starts_at =
    meeting.scheduledStart?.toISOString() ??
    new Date().toISOString();
  const ends_at =
    meeting.scheduledEnd?.toISOString() ?? starts_at;

  return {
    id: meeting.id,
    event_id: meeting.eventId,
    event_name: meeting.event.name,
    status: meeting.status,
    counterparty: mapCounterparty(counterpartyUser),
    starts_at,
    ends_at,
    table_number: meeting.table?.name,
    venue_label: meeting.table?.area.name,
    is_incoming:
      meeting.status === MeetingStatus.PENDING && meeting.recipientId === viewerId,
    wechat_exchanged: meeting.wechatExchanged,
    match_score: meeting.aiMatchScore ?? undefined,
    ai_recommend_reason: meeting.fromAiMatch ? meeting.message ?? undefined : undefined,
  };
}

const meetingInclude = {
  event: { select: { name: true } },
  requester: {
    select: {
      id: true,
      name: true,
      profile: { select: { company: true } },
    },
  },
  recipient: {
    select: {
      id: true,
      name: true,
      profile: { select: { company: true } },
    },
  },
  table: { include: { area: { select: { name: true } } } },
} as const;

export async function listMyMeetings(
  userId: string,
  eventId?: string,
): Promise<ApiMobileMeetingListItem[]> {
  const meetings = await prisma.meeting.findMany({
    where: {
      OR: [{ requesterId: userId }, { recipientId: userId }],
      ...(eventId ? { eventId } : {}),
    },
    include: meetingInclude,
    orderBy: [{ scheduledStart: "asc" }, { createdAt: "desc" }],
  });

  return meetings.map((m) => mapMeetingListItem(m, userId));
}

export async function getMyMeetingDetail(userId: string, meetingId: string) {
  const meeting = await prisma.meeting.findUnique({
    where: { id: meetingId },
    include: meetingInclude,
  });

  if (!meeting) {
    throw new ApiError("会面不存在", ErrorCode.NOT_FOUND, 404);
  }
  if (meeting.requesterId !== userId && meeting.recipientId !== userId) {
    throw new ApiError("无权查看此会面", ErrorCode.FORBIDDEN, 403);
  }

  const item = mapMeetingListItem(meeting, userId);
  const isRequester = meeting.requesterId === userId;

  return {
    ...item,
    initiator_id: meeting.requesterId,
    message: meeting.message,
    requester: mapCounterparty(meeting.requester),
    recipient: mapCounterparty(meeting.recipient),
    is_incoming: item.is_incoming,
    peer: item.counterparty,
    scheduled_start: item.starts_at,
    scheduled_end: item.ends_at,
    table_name: item.table_number,
    area_name: item.venue_label,
    from_ai_match: meeting.fromAiMatch,
    ai_match_score: meeting.aiMatchScore,
    role: isRequester ? "requester" : "recipient",
  };
}

function userBusyAtSlot(
  userId: string,
  slotStart: Date,
  slotEnd: Date,
  meetings: Array<{
    requesterId: string;
    recipientId: string;
    scheduledStart: Date | null;
    scheduledEnd: Date | null;
    status: MeetingStatus;
  }>,
): boolean {
  return meetings.some(
    (m) =>
      (m.requesterId === userId || m.recipientId === userId) &&
      (m.status === MeetingStatus.ACCEPTED ||
        m.status === MeetingStatus.PENDING ||
        m.status === MeetingStatus.COMPLETED) &&
      m.scheduledStart &&
      m.scheduledEnd &&
      intervalsOverlap(slotStart, slotEnd, m.scheduledStart, m.scheduledEnd),
  );
}

export async function getAttendeeMeetingTimeSlots(
  eventId: string,
  viewerId: string,
  withUserId?: string,
): Promise<ApiMeetingTimeSlot[]> {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      meetingSlotMinutes: true,
      meetingBufferMinutes: true,
      startDate: true,
    },
  });
  if (!event) {
    throw new ApiError("活动不存在", ErrorCode.NOT_FOUND, 404);
  }

  const slotMinutes = event.meetingSlotMinutes || 20;
  const bufferMinutes = event.meetingBufferMinutes || 5;
  const baseDate = resolveScheduleBaseDate(event.startDate);
  const windows = await loadWindows(eventId);

  const slotCandidates = generateSlotCandidates({
    baseDate,
    windows,
    slotMinutes,
    bufferMinutes,
  });

  const userIds = [viewerId, withUserId].filter(Boolean) as string[];
  const meetings = await prisma.meeting.findMany({
    where: {
      eventId,
      OR: userIds.flatMap((uid) => [{ requesterId: uid }, { recipientId: uid }]),
    },
    select: {
      requesterId: true,
      recipientId: true,
      scheduledStart: true,
      scheduledEnd: true,
      status: true,
    },
  });

  const now = Date.now();

  return slotCandidates
    .filter((slot) => slot.start.getTime() > now)
    .map((slot, index) => {
      const time_label = formatTimeLabel(slot.start);
      const viewerBusy = userBusyAtSlot(viewerId, slot.start, slot.end, meetings);
      const peerBusy = withUserId
        ? userBusyAtSlot(withUserId, slot.start, slot.end, meetings)
        : false;

      let status: ApiMeetingTimeSlot["status"] = "available";
      if (viewerBusy || peerBusy) {
        status = "occupied";
      } else if (withUserId) {
        status = "mutual_free";
      }

      const label =
        status === "occupied"
          ? `${time_label} 已占用`
          : status === "mutual_free"
            ? `${time_label} 双方可约`
            : `${time_label} 可约`;

      return {
        id: `slot-${index}-${slot.start.toISOString()}`,
        starts_at: slot.start.toISOString(),
        ends_at: slot.end.toISOString(),
        label,
        time_label,
        status,
      };
    });
}
