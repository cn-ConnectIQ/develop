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

const STATUS_LABELS: Record<MeetingStatus, string> = {
  PENDING: "待确认",
  ACCEPTED: "已确认",
  DECLINED: "已婉拒",
  CANCELLED: "已取消",
  COMPLETED: "已完成",
  NO_SHOW: "爽约",
};

export type ApiMeetingRow = {
  id: string;
  requester: { id: string; name: string };
  recipient: { id: string; name: string };
  status: MeetingStatus;
  status_label: string;
  scheduled_start: string | null;
  scheduled_end: string | null;
  table_id: string | null;
  table_name: string | null;
  area_name: string | null;
  from_ai_match: boolean;
  ai_match_score: number | null;
  message: string | null;
  conflict: boolean;
};

export type ApiMeetingStats = {
  total: number;
  by_status: Record<MeetingStatus, number>;
  acceptance_rate: number;
  ai_facilitated_rate: number;
  table_utilization: number;
};

export type ScheduleGridCell = {
  slot_index: number;
  status: "free" | "booked" | "conflict";
  meeting_id?: string;
  requester_name?: string;
  recipient_name?: string;
  meeting_status?: MeetingStatus;
};

export type ScheduleGridRow = {
  table_id: string;
  table_name: string;
  area_name: string;
  cells: ScheduleGridCell[];
};

export type ApiScheduleGrid = {
  date: string;
  slot_minutes: number;
  buffer_minutes: number;
  slots: Array<{ label: string; start: string; end: string }>;
  rows: ScheduleGridRow[];
  conflicts: Array<{ meeting_id: string; message: string }>;
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

function formatSlotLabel(d: Date): string {
  return d.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function detectMeetingConflicts(
  meetings: Array<{
    id: string;
    requesterId: string;
    recipientId: string;
    tableId: string | null;
    scheduledStart: Date | null;
    scheduledEnd: Date | null;
    status: MeetingStatus;
  }>,
): Set<string> {
  const conflictIds = new Set<string>();
  const active = meetings.filter(
    (m) =>
      m.scheduledStart &&
      m.scheduledEnd &&
      (m.status === MeetingStatus.ACCEPTED || m.status === MeetingStatus.COMPLETED),
  );

  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      const a = active[i]!;
      const b = active[j]!;
      const overlap = intervalsOverlap(
        a.scheduledStart!,
        a.scheduledEnd!,
        b.scheduledStart!,
        b.scheduledEnd!,
      );
      if (!overlap) continue;

      const sameTable = a.tableId && b.tableId && a.tableId === b.tableId;
      const sameUser =
        a.requesterId === b.requesterId ||
        a.requesterId === b.recipientId ||
        a.recipientId === b.requesterId ||
        a.recipientId === b.recipientId;

      if (sameTable || sameUser) {
        conflictIds.add(a.id);
        conflictIds.add(b.id);
      }
    }
  }
  return conflictIds;
}

export async function getEventMeetingStats(eventId: string): Promise<ApiMeetingStats> {
  const [meetings, event, tableCount, windows] = await Promise.all([
    prisma.meeting.findMany({
      where: { eventId },
      select: { status: true, fromAiMatch: true, tableId: true, scheduledStart: true, scheduledEnd: true },
    }),
    prisma.event.findUnique({
      where: { id: eventId },
      select: {
        meetingSlotMinutes: true,
        meetingBufferMinutes: true,
        startDate: true,
      },
    }),
    prisma.meetingTable.count({ where: { area: { eventId } } }),
    loadWindows(eventId),
  ]);

  const by_status = {
    PENDING: 0,
    ACCEPTED: 0,
    DECLINED: 0,
    CANCELLED: 0,
    COMPLETED: 0,
    NO_SHOW: 0,
  } satisfies Record<MeetingStatus, number>;

  for (const m of meetings) {
    by_status[m.status]++;
  }

  const responded = by_status.ACCEPTED + by_status.DECLINED;
  const acceptance_rate =
    responded > 0 ? Math.round((by_status.ACCEPTED / responded) * 100) : 0;

  const scheduledActive = meetings.filter(
    (m) => m.status === MeetingStatus.ACCEPTED || m.status === MeetingStatus.COMPLETED,
  );
  const aiCount = scheduledActive.filter((m) => m.fromAiMatch).length;
  const ai_facilitated_rate =
    scheduledActive.length > 0
      ? Math.round((aiCount / scheduledActive.length) * 100)
      : 0;

  let table_utilization = 0;
  if (event && tableCount > 0) {
    const baseDate = resolveScheduleBaseDate(event.startDate);
    const slotCandidates = generateSlotCandidates({
      baseDate,
      windows,
      slotMinutes: event.meetingSlotMinutes || 20,
      bufferMinutes: event.meetingBufferMinutes || 5,
    });
    const totalCapacity = tableCount * slotCandidates.length;
    const booked = scheduledActive.filter((m) => m.tableId && m.scheduledStart).length;
    table_utilization =
      totalCapacity > 0 ? Math.round((booked / totalCapacity) * 100) : 0;
  }

  return {
    total: meetings.length,
    by_status,
    acceptance_rate,
    ai_facilitated_rate,
    table_utilization,
  };
}

export async function listEventMeetings(
  eventId: string,
  filters?: { status?: MeetingStatus; from?: string; to?: string },
): Promise<ApiMeetingRow[]> {
  const meetings = await prisma.meeting.findMany({
    where: {
      eventId,
      ...(filters?.status ? { status: filters.status } : {}),
      ...(filters?.from || filters?.to
        ? {
            scheduledStart: {
              ...(filters.from ? { gte: new Date(filters.from) } : {}),
              ...(filters.to ? { lte: new Date(filters.to) } : {}),
            },
          }
        : {}),
    },
    include: {
      requester: { select: { id: true, name: true } },
      recipient: { select: { id: true, name: true } },
      table: { include: { area: { select: { name: true } } } },
    },
    orderBy: [{ scheduledStart: "asc" }, { createdAt: "desc" }],
  });

  const conflictIds = detectMeetingConflicts(meetings);

  return meetings.map((m) => ({
    id: m.id,
    requester: m.requester,
    recipient: m.recipient,
    status: m.status,
    status_label: STATUS_LABELS[m.status],
    scheduled_start: m.scheduledStart?.toISOString() ?? null,
    scheduled_end: m.scheduledEnd?.toISOString() ?? null,
    table_id: m.tableId,
    table_name: m.table?.name ?? null,
    area_name: m.table?.area.name ?? null,
    from_ai_match: m.fromAiMatch,
    ai_match_score: m.aiMatchScore,
    message: m.message,
    conflict: conflictIds.has(m.id),
  }));
}

export async function getEventScheduleGrid(eventId: string): Promise<ApiScheduleGrid> {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      meetingSlotMinutes: true,
      meetingBufferMinutes: true,
      startDate: true,
    },
  });
  if (!event) throw new ApiError("活动不存在", ErrorCode.NOT_FOUND, 404);

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

  const slots = slotCandidates.map((s) => ({
    label: formatSlotLabel(s.start),
    start: s.start.toISOString(),
    end: s.end.toISOString(),
  }));

  const tables = await prisma.meetingTable.findMany({
    where: { area: { eventId } },
    include: { area: { select: { name: true } } },
    orderBy: [{ area: { name: "asc" } }, { name: "asc" }],
  });

  const meetings = await prisma.meeting.findMany({
    where: {
      eventId,
      status: { in: [MeetingStatus.ACCEPTED, MeetingStatus.COMPLETED, MeetingStatus.PENDING] },
      scheduledStart: { not: null },
      scheduledEnd: { not: null },
    },
    include: {
      requester: { select: { name: true } },
      recipient: { select: { name: true } },
    },
  });

  const conflictIds = detectMeetingConflicts(meetings);
  const conflicts = [...conflictIds].map((id) => ({
    meeting_id: id,
    message: "时间或桌位冲突",
  }));

  const rows: ScheduleGridRow[] = tables.map((table) => {
    const cells: ScheduleGridCell[] = slotCandidates.map((slot, slotIndex) => {
      const booked = meetings.find(
        (m) =>
          m.tableId === table.id &&
          m.scheduledStart &&
          m.scheduledEnd &&
          intervalsOverlap(
            slot.start,
            slot.end,
            m.scheduledStart,
            m.scheduledEnd,
          ),
      );

      if (!booked) {
        return { slot_index: slotIndex, status: "free" as const };
      }

      const status = conflictIds.has(booked.id) ? ("conflict" as const) : ("booked" as const);
      return {
        slot_index: slotIndex,
        status,
        meeting_id: booked.id,
        requester_name: booked.requester.name,
        recipient_name: booked.recipient.name,
        meeting_status: booked.status,
      };
    });

    return {
      table_id: table.id,
      table_name: table.name,
      area_name: table.area.name,
      cells,
    };
  });

  return {
    date: baseDate.toISOString().slice(0, 10),
    slot_minutes: slotMinutes,
    buffer_minutes: bufferMinutes,
    slots,
    rows,
    conflicts,
  };
}

export async function reassignMeeting(
  eventId: string,
  meetingId: string,
  input: {
    scheduled_start: string;
    scheduled_end: string;
    table_id: string;
  },
): Promise<ApiMeetingRow> {
  const meeting = await prisma.meeting.findFirst({
    where: { id: meetingId, eventId },
  });
  if (!meeting) {
    throw new ApiError("会面不存在", ErrorCode.NOT_FOUND, 404);
  }

  const table = await prisma.meetingTable.findFirst({
    where: { id: input.table_id, area: { eventId } },
  });
  if (!table) {
    throw new ApiError("桌位不存在", ErrorCode.NOT_FOUND, 404);
  }

  const start = new Date(input.scheduled_start);
  const end = new Date(input.scheduled_end);
  if (end <= start) {
    throw new ApiError("结束时间须晚于开始时间", ErrorCode.VALIDATION_ERROR, 400);
  }

  await prisma.meeting.update({
    where: { id: meetingId },
    data: {
      scheduledStart: start,
      scheduledEnd: end,
      tableId: input.table_id,
      status:
        meeting.status === MeetingStatus.PENDING
          ? MeetingStatus.ACCEPTED
          : meeting.status,
      respondedAt: new Date(),
    },
  });

  const rows = await listEventMeetings(eventId);
  const row = rows.find((r) => r.id === meetingId);
  if (!row) throw new ApiError("会面不存在", ErrorCode.NOT_FOUND, 404);
  return row;
}
