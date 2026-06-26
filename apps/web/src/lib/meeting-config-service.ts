import { prisma } from "@connectiq/database";

export const MEETING_TIME_WINDOWS_KEY = "meeting_time_windows";

export type MeetingTimeWindow = {
  start: string;
  end: string;
};

export type ApiMeetingArea = {
  id: string;
  name: string;
  location: string | null;
  tables: ApiMeetingTable[];
};

export type ApiMeetingTable = {
  id: string;
  area_id: string;
  name: string;
  capacity: number;
};

export type ApiMeetingConfig = {
  meeting_enabled: boolean;
  meeting_slot_minutes: number;
  meeting_buffer_minutes: number;
  meeting_open_at: string | null;
  time_windows: MeetingTimeWindow[];
  total_tables: number;
  daily_meeting_capacity: number;
};

async function loadTimeWindows(eventId: string): Promise<MeetingTimeWindow[]> {
  const row = await prisma.eventSetting.findUnique({
    where: { eventId_key: { eventId, key: MEETING_TIME_WINDOWS_KEY } },
  });
  if (!row?.value || !Array.isArray(row.value)) return [];
  return (row.value as MeetingTimeWindow[]).filter(
    (w) => typeof w.start === "string" && typeof w.end === "string",
  );
}

function parseTimeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export function computeDailyMeetingCapacity(params: {
  totalTables: number;
  slotMinutes: number;
  bufferMinutes: number;
  timeWindows: MeetingTimeWindow[];
}): number {
  const { totalTables, slotMinutes, bufferMinutes, timeWindows } = params;
  if (totalTables <= 0 || timeWindows.length === 0) return 0;

  const slotBlock = Math.max(1, slotMinutes + bufferMinutes);
  let openMinutes = 0;
  for (const window of timeWindows) {
    const start = parseTimeToMinutes(window.start);
    const end = parseTimeToMinutes(window.end);
    if (end > start) openMinutes += end - start;
  }
  if (openMinutes <= 0) return 0;

  const slotsPerTable = Math.floor(openMinutes / slotBlock);
  return totalTables * slotsPerTable;
}

export async function getMeetingConfig(eventId: string): Promise<ApiMeetingConfig> {
  const [event, timeWindows, tableCount] = await Promise.all([
    prisma.event.findUnique({
      where: { id: eventId },
      select: {
        meetingEnabled: true,
        meetingSlotMinutes: true,
        meetingBufferMinutes: true,
        meetingOpenAt: true,
      },
    }),
    loadTimeWindows(eventId),
    prisma.meetingTable.count({
      where: { area: { eventId } },
    }),
  ]);

  if (!event) {
    throw new Error("活动不存在");
  }

  const dailyMeetingCapacity = computeDailyMeetingCapacity({
    totalTables: tableCount,
    slotMinutes: event.meetingSlotMinutes,
    bufferMinutes: event.meetingBufferMinutes,
    timeWindows,
  });

  return {
    meeting_enabled: event.meetingEnabled,
    meeting_slot_minutes: event.meetingSlotMinutes,
    meeting_buffer_minutes: event.meetingBufferMinutes,
    meeting_open_at: event.meetingOpenAt?.toISOString() ?? null,
    time_windows: timeWindows,
    total_tables: tableCount,
    daily_meeting_capacity: dailyMeetingCapacity,
  };
}

export async function updateMeetingConfig(
  eventId: string,
  data: {
    meeting_enabled?: boolean;
    meeting_slot_minutes?: number;
    meeting_buffer_minutes?: number;
    meeting_open_at?: string | null;
    time_windows?: MeetingTimeWindow[];
  },
): Promise<ApiMeetingConfig> {
  const eventUpdate: {
    meetingEnabled?: boolean;
    meetingSlotMinutes?: number;
    meetingBufferMinutes?: number;
    meetingOpenAt?: Date | null;
  } = {};

  if (data.meeting_enabled !== undefined) {
    eventUpdate.meetingEnabled = data.meeting_enabled;
  }
  if (data.meeting_slot_minutes !== undefined) {
    eventUpdate.meetingSlotMinutes = data.meeting_slot_minutes;
  }
  if (data.meeting_buffer_minutes !== undefined) {
    eventUpdate.meetingBufferMinutes = data.meeting_buffer_minutes;
  }
  if (data.meeting_open_at !== undefined) {
    eventUpdate.meetingOpenAt = data.meeting_open_at
      ? new Date(data.meeting_open_at)
      : null;
  }

  if (Object.keys(eventUpdate).length > 0) {
    await prisma.event.update({
      where: { id: eventId },
      data: eventUpdate,
    });
  }

  if (data.time_windows !== undefined) {
    await prisma.eventSetting.upsert({
      where: { eventId_key: { eventId, key: MEETING_TIME_WINDOWS_KEY } },
      create: {
        eventId,
        key: MEETING_TIME_WINDOWS_KEY,
        value: data.time_windows,
      },
      update: { value: data.time_windows },
    });
  }

  return getMeetingConfig(eventId);
}

export async function listMeetingAreas(eventId: string): Promise<ApiMeetingArea[]> {
  const areas = await prisma.meetingArea.findMany({
    where: { eventId },
    include: {
      tables: { orderBy: { name: "asc" } },
    },
    orderBy: { createdAt: "asc" },
  });

  return areas.map((area) => ({
    id: area.id,
    name: area.name,
    location: area.location,
    tables: area.tables.map((table) => ({
      id: table.id,
      area_id: table.areaId,
      name: table.name,
      capacity: table.capacity,
    })),
  }));
}

export async function createMeetingArea(
  eventId: string,
  input: { name: string; location?: string | null },
): Promise<ApiMeetingArea> {
  const area = await prisma.meetingArea.create({
    data: {
      eventId,
      name: input.name.trim(),
      location: input.location?.trim() || null,
    },
    include: { tables: true },
  });

  return {
    id: area.id,
    name: area.name,
    location: area.location,
    tables: [],
  };
}

export async function deleteMeetingArea(eventId: string, areaId: string): Promise<void> {
  const area = await prisma.meetingArea.findFirst({
    where: { id: areaId, eventId },
  });
  if (!area) {
    throw new Error("会面区不存在");
  }
  await prisma.meetingArea.delete({ where: { id: areaId } });
}

export async function createMeetingTables(
  eventId: string,
  input: {
    area_id: string;
    name?: string;
    capacity?: number;
    bulk_count?: number;
  },
): Promise<ApiMeetingTable[]> {
  const area = await prisma.meetingArea.findFirst({
    where: { id: input.area_id, eventId },
    include: { tables: { select: { name: true } } },
  });
  if (!area) {
    throw new Error("会面区不存在");
  }

  const capacity = input.capacity ?? 2;
  const existingNumbers = area.tables
    .map((t) => {
      const match = t.name.match(/(\d+)\s*$/);
      return match ? Number(match[1]) : 0;
    })
    .filter((n) => n > 0);
  let nextNum = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 1;

  const rows: { areaId: string; name: string; capacity: number }[] = [];

  if (input.bulk_count && input.bulk_count > 0) {
    for (let i = 0; i < input.bulk_count; i++) {
      rows.push({
        areaId: area.id,
        name: `桌 ${String(nextNum).padStart(2, "0")}`,
        capacity,
      });
      nextNum++;
    }
  } else {
    rows.push({
      areaId: area.id,
      name: input.name?.trim() || `桌 ${String(nextNum).padStart(2, "0")}`,
      capacity,
    });
  }

  const created = await prisma.$transaction(
    rows.map((row) => prisma.meetingTable.create({ data: row })),
  );

  return created.map((table) => ({
    id: table.id,
    area_id: table.areaId,
    name: table.name,
    capacity: table.capacity,
  }));
}

export async function deleteMeetingTable(eventId: string, tableId: string): Promise<void> {
  const table = await prisma.meetingTable.findFirst({
    where: { id: tableId, area: { eventId } },
  });
  if (!table) {
    throw new Error("桌位不存在");
  }
  await prisma.meetingTable.delete({ where: { id: tableId } });
}
