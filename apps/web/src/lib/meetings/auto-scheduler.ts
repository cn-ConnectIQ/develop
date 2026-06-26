import { MeetingStatus, prisma } from "@connectiq/database";
import {
  type MeetingTimeWindow,
  MEETING_TIME_WINDOWS_KEY,
} from "@/lib/meeting-config-service";

const DEFAULT_WINDOWS: MeetingTimeWindow[] = [
  { start: "10:00", end: "12:00" },
  { start: "14:00", end: "17:00" },
];

export type ScheduleSuccess = {
  ok: true;
  scheduledStart: Date;
  scheduledEnd: Date;
  tableId: string;
};

export type ScheduleFailure = {
  ok: false;
  reason: string;
};

export type ScheduleResult = ScheduleSuccess | ScheduleFailure;

type ScheduledMeeting = {
  id: string;
  requesterId: string;
  recipientId: string;
  tableId: string | null;
  scheduledStart: Date | null;
  scheduledEnd: Date | null;
  status: MeetingStatus;
};

function parseTimeOnDate(base: Date, time: string): Date {
  const [h, m] = time.split(":").map(Number);
  const d = new Date(base);
  d.setHours(h ?? 0, m ?? 0, 0, 0);
  return d;
}

function addMinutes(d: Date, minutes: number): Date {
  return new Date(d.getTime() + minutes * 60_000);
}

async function loadTimeWindows(eventId: string): Promise<MeetingTimeWindow[]> {
  const row = await prisma.eventSetting.findUnique({
    where: { eventId_key: { eventId, key: MEETING_TIME_WINDOWS_KEY } },
  });
  if (!row?.value || !Array.isArray(row.value)) return DEFAULT_WINDOWS;
  const windows = (row.value as MeetingTimeWindow[]).filter(
    (w) => typeof w.start === "string" && typeof w.end === "string",
  );
  return windows.length > 0 ? windows : DEFAULT_WINDOWS;
}

export function generateSlotCandidates(params: {
  baseDate: Date;
  windows: MeetingTimeWindow[];
  slotMinutes: number;
  bufferMinutes: number;
}): Array<{ start: Date; end: Date }> {
  const { baseDate, windows, slotMinutes, bufferMinutes } = params;
  const block = slotMinutes + bufferMinutes;
  const slots: Array<{ start: Date; end: Date }> = [];

  for (const window of windows) {
    let cursor = parseTimeOnDate(baseDate, window.start);
    const windowEnd = parseTimeOnDate(baseDate, window.end);
    while (addMinutes(cursor, slotMinutes) <= windowEnd) {
      const end = addMinutes(cursor, slotMinutes);
      slots.push({ start: new Date(cursor), end });
      cursor = addMinutes(cursor, block);
    }
  }
  return slots;
}

function withBuffer(
  start: Date,
  end: Date,
  bufferMinutes: number,
): { start: Date; end: Date } {
  return {
    start: addMinutes(start, -bufferMinutes),
    end: addMinutes(end, bufferMinutes),
  };
}

export function intervalsOverlap(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date,
): boolean {
  return aStart < bEnd && bStart < aEnd;
}

function isUserBusy(
  userId: string,
  meetings: ScheduledMeeting[],
  slotStart: Date,
  slotEnd: Date,
  bufferMinutes: number,
  excludeMeetingId?: string,
): boolean {
  const padded = withBuffer(slotStart, slotEnd, bufferMinutes);
  return meetings.some((m) => {
    if (m.id === excludeMeetingId) return false;
    if (m.status !== MeetingStatus.ACCEPTED && m.status !== MeetingStatus.COMPLETED) {
      return false;
    }
    if (!m.scheduledStart || !m.scheduledEnd) return false;
    const busy = withBuffer(m.scheduledStart, m.scheduledEnd, bufferMinutes);
    const involvesUser = m.requesterId === userId || m.recipientId === userId;
    if (!involvesUser) return false;
    return intervalsOverlap(padded.start, padded.end, busy.start, busy.end);
  });
}

function isTableBusy(
  tableId: string,
  meetings: ScheduledMeeting[],
  slotStart: Date,
  slotEnd: Date,
  excludeMeetingId?: string,
): boolean {
  return meetings.some((m) => {
    if (m.id === excludeMeetingId) return false;
    if (m.tableId !== tableId) return false;
    if (m.status !== MeetingStatus.ACCEPTED && m.status !== MeetingStatus.COMPLETED) {
      return false;
    }
    if (!m.scheduledStart || !m.scheduledEnd) return false;
    return intervalsOverlap(slotStart, slotEnd, m.scheduledStart, m.scheduledEnd);
  });
}

export function resolveScheduleBaseDate(eventStart: Date | null): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (!eventStart) return today;
  const eventDay = new Date(eventStart);
  eventDay.setHours(0, 0, 0, 0);
  return eventDay >= today ? eventDay : today;
}

export async function scheduleMeeting(meetingId: string): Promise<ScheduleResult> {
  const meeting = await prisma.meeting.findUnique({
    where: { id: meetingId },
    include: {
      event: {
        select: {
          id: true,
          startDate: true,
          meetingSlotMinutes: true,
          meetingBufferMinutes: true,
        },
      },
    },
  });

  if (!meeting) {
    return { ok: false, reason: "会面不存在" };
  }

  if (meeting.status !== MeetingStatus.ACCEPTED) {
    return { ok: false, reason: "仅已接受的会面可自动排期" };
  }

  const tables = await prisma.meetingTable.findMany({
    where: { area: { eventId: meeting.eventId } },
    orderBy: { name: "asc" },
  });

  if (tables.length === 0) {
    return { ok: false, reason: "暂无会面桌，请联系主办方配置" };
  }

  const slotMinutes = meeting.event.meetingSlotMinutes || 20;
  const bufferMinutes = meeting.event.meetingBufferMinutes || 5;
  const windows = await loadTimeWindows(meeting.eventId);
  const baseDate = resolveScheduleBaseDate(meeting.event.startDate);

  const existing = await prisma.meeting.findMany({
    where: {
      eventId: meeting.eventId,
      status: { in: [MeetingStatus.ACCEPTED, MeetingStatus.COMPLETED] },
      scheduledStart: { not: null },
    },
    select: {
      id: true,
      requesterId: true,
      recipientId: true,
      tableId: true,
      scheduledStart: true,
      scheduledEnd: true,
      status: true,
    },
  });

  const preferredStart = meeting.scheduledStart;
  const preferredEnd =
    meeting.scheduledEnd ??
    (preferredStart ? addMinutes(preferredStart, slotMinutes) : null);

  const candidates: Array<{ start: Date; end: Date }> = [];

  if (preferredStart && preferredEnd) {
    candidates.push({ start: preferredStart, end: preferredEnd });
  }

  candidates.push(
    ...generateSlotCandidates({
      baseDate,
      windows,
      slotMinutes,
      bufferMinutes,
    }),
  );

  for (const slot of candidates) {
    for (const table of tables) {
      if (
        isUserBusy(
          meeting.requesterId,
          existing,
          slot.start,
          slot.end,
          bufferMinutes,
          meeting.id,
        )
      ) {
        continue;
      }
      if (
        isUserBusy(
          meeting.recipientId,
          existing,
          slot.start,
          slot.end,
          bufferMinutes,
          meeting.id,
        )
      ) {
        continue;
      }
      if (isTableBusy(table.id, existing, slot.start, slot.end, meeting.id)) {
        continue;
      }

      await prisma.meeting.update({
        where: { id: meetingId },
        data: {
          scheduledStart: slot.start,
          scheduledEnd: slot.end,
          tableId: table.id,
        },
      });

      return {
        ok: true,
        scheduledStart: slot.start,
        scheduledEnd: slot.end,
        tableId: table.id,
      };
    }
  }

  return {
    ok: false,
    reason: "暂无合适时段，请手动协调",
  };
}

export async function notifyScheduleFailure(
  meetingId: string,
  reason: string,
): Promise<void> {
  const meeting = await prisma.meeting.findUnique({
    where: { id: meetingId },
    select: { requesterId: true, recipientId: true },
  });
  if (!meeting) return;

  const body = `${reason}，请与主办方或对方协商时间。`;
  await prisma.notification.createMany({
    data: [
      { userId: meeting.requesterId, title: "会面排期未成功", body },
      { userId: meeting.recipientId, title: "会面排期未成功", body },
    ],
  });
}

export async function tryAutoScheduleMeeting(meetingId: string): Promise<ScheduleResult> {
  const meeting = await prisma.meeting.findUnique({
    where: { id: meetingId },
    select: { tableId: true, scheduledStart: true, scheduledEnd: true },
  });

  if (meeting?.tableId && meeting.scheduledStart && meeting.scheduledEnd) {
    return {
      ok: true,
      scheduledStart: meeting.scheduledStart,
      scheduledEnd: meeting.scheduledEnd,
      tableId: meeting.tableId,
    };
  }

  const result = await scheduleMeeting(meetingId);
  if (!result.ok) {
    await notifyScheduleFailure(meetingId, result.reason);
  }
  return result;
}
