/**
 * 1:1 会面演示数据 — 桌位区 / 时段配置 / 已排期会面（含冲突示例）
 */
import { MeetingStatus, Prisma } from "@prisma/client";
import { prisma } from "../src/client";

const MTG_PREFIX = "seed-mtg";
const FEAT_MEETING_IDS = [
  "seed-feat-meeting-1",
  "seed-feat-meeting-2",
  "seed-feat-meeting-3",
] as const;

export const MEETING_TIME_WINDOWS_KEY = "meeting_time_windows";

const DEFAULT_TIME_WINDOWS = [
  { start: "10:00", end: "12:00" },
  { start: "14:00", end: "17:00" },
] satisfies Array<{ start: string; end: string }>;

export const SEED_MTG = {
  areas: {
    hostedNegotiation: `${MTG_PREFIX}-area-hosted-negotiation`,
    hostedVip: `${MTG_PREFIX}-area-hosted-vip`,
    summit: `${MTG_PREFIX}-area-summit`,
    innovation: `${MTG_PREFIX}-area-innovation`,
  },
  tables: {
    hostedA01: `${MTG_PREFIX}-table-hosted-a-01`,
    hostedA02: `${MTG_PREFIX}-table-hosted-a-02`,
    hostedA03: `${MTG_PREFIX}-table-hosted-a-03`,
    hostedA04: `${MTG_PREFIX}-table-hosted-a-04`,
    hostedA05: `${MTG_PREFIX}-table-hosted-a-05`,
    hostedA06: `${MTG_PREFIX}-table-hosted-a-06`,
    hostedB01: `${MTG_PREFIX}-table-hosted-b-01`,
    hostedB02: `${MTG_PREFIX}-table-hosted-b-02`,
    hostedB03: `${MTG_PREFIX}-table-hosted-b-03`,
    hostedB04: `${MTG_PREFIX}-table-hosted-b-04`,
    summit01: `${MTG_PREFIX}-table-summit-01`,
    summit02: `${MTG_PREFIX}-table-summit-02`,
    summit03: `${MTG_PREFIX}-table-summit-03`,
    innovation01: `${MTG_PREFIX}-table-innovation-01`,
    innovation02: `${MTG_PREFIX}-table-innovation-02`,
  },
  meetings: [
    `${MTG_PREFIX}-meeting-hosted-01`,
    `${MTG_PREFIX}-meeting-hosted-02`,
    `${MTG_PREFIX}-meeting-hosted-03`,
    `${MTG_PREFIX}-meeting-hosted-04`,
    `${MTG_PREFIX}-meeting-hosted-05`,
    `${MTG_PREFIX}-meeting-hosted-06`,
    `${MTG_PREFIX}-meeting-hosted-07`,
    `${MTG_PREFIX}-meeting-hosted-08`,
    `${MTG_PREFIX}-meeting-conflict-a`,
    `${MTG_PREFIX}-meeting-conflict-b`,
    `${MTG_PREFIX}-meeting-summit-01`,
    `${MTG_PREFIX}-meeting-summit-02`,
  ],
  intents: [
    `${MTG_PREFIX}-intent-hosted-01`,
    `${MTG_PREFIX}-intent-hosted-02`,
    `${MTG_PREFIX}-intent-hosted-03`,
    `${MTG_PREFIX}-intent-hosted-04`,
    `${MTG_PREFIX}-intent-hosted-05`,
    `${MTG_PREFIX}-intent-hosted-06`,
    `${MTG_PREFIX}-intent-summit-01`,
    `${MTG_PREFIX}-intent-summit-02`,
  ],
} as const;

export type SeedMeetingsContext = {
  hostedExpoEventId: string;
  saasSummitEventId: string;
  innovationSummitEventId: string;
  endUserIds: string[];
};

function resolveScheduleBaseDate(eventStart: Date | null): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (!eventStart) return today;
  const eventDay = new Date(eventStart);
  eventDay.setHours(0, 0, 0, 0);
  return eventDay >= today ? eventDay : today;
}

function slotOnDate(
  baseDate: Date,
  hour: number,
  minute: number,
  durationMinutes = 20,
): { start: Date; end: Date } {
  const start = new Date(baseDate);
  start.setHours(hour, minute, 0, 0);
  const end = new Date(start.getTime() + durationMinutes * 60_000);
  return { start, end };
}

function daysAgo(days: number, hours = 10) {
  return new Date(Date.now() - days * 86_400_000 - hours * 3_600_000);
}

export async function clearSeedMeetingData() {
  await prisma.meeting.deleteMany({
    where: { id: { in: [...SEED_MTG.meetings] } },
  });
  await prisma.userEventIntent.deleteMany({
    where: { id: { in: [...SEED_MTG.intents] } },
  });
  await prisma.meetingTable.deleteMany({
    where: { id: { in: Object.values(SEED_MTG.tables) } },
  });
  await prisma.meetingArea.deleteMany({
    where: { id: { in: Object.values(SEED_MTG.areas) } },
  });
}

async function upsertMeetingTimeWindows(eventId: string) {
  await prisma.eventSetting.upsert({
    where: { eventId_key: { eventId, key: MEETING_TIME_WINDOWS_KEY } },
    create: {
      eventId,
      key: MEETING_TIME_WINDOWS_KEY,
      value: DEFAULT_TIME_WINDOWS,
    },
    update: { value: DEFAULT_TIME_WINDOWS },
  });
}

async function enableMeetingFeatures(
  eventId: string,
  opts?: { premeet?: boolean },
) {
  await prisma.event.update({
    where: { id: eventId },
    data: {
      meetingEnabled: true,
      meetingSlotMinutes: 20,
      meetingBufferMinutes: 5,
      meetingOpenAt: daysAgo(2),
      ...(opts?.premeet
        ? {
            premeetEnabled: true,
            premeetOpenAt: daysAgo(3),
            intentConfig: {
              fields: [
                { key: "supply", label: "我能提供", type: "tags", pool: "SUPPLY" },
                { key: "demand", label: "我在寻找", type: "tags", pool: "DEMAND" },
                { key: "topics", label: "关注话题", type: "tags", pool: "TOPIC" },
              ],
              premeet_days_before: 7,
            } satisfies Prisma.InputJsonValue,
          }
        : {}),
    },
  });
}

async function seedMeetingAreasAndTables(ctx: SeedMeetingsContext) {
  const { hostedExpoEventId, saasSummitEventId, innovationSummitEventId } = ctx;

  await prisma.meetingArea.upsert({
    where: { id: SEED_MTG.areas.hostedNegotiation },
    update: { name: "商务洽谈区 A", location: "B 馆 2 层东侧" },
    create: {
      id: SEED_MTG.areas.hostedNegotiation,
      eventId: hostedExpoEventId,
      name: "商务洽谈区 A",
      location: "B 馆 2 层东侧",
    },
  });

  await prisma.meetingArea.upsert({
    where: { id: SEED_MTG.areas.hostedVip },
    update: { name: "VIP 会客厅", location: "A 馆贵宾区" },
    create: {
      id: SEED_MTG.areas.hostedVip,
      eventId: hostedExpoEventId,
      name: "VIP 会客厅",
      location: "A 馆贵宾区",
    },
  });

  await prisma.meetingArea.upsert({
    where: { id: SEED_MTG.areas.summit },
    update: { name: "峰会洽谈角", location: "主会场合页区" },
    create: {
      id: SEED_MTG.areas.summit,
      eventId: saasSummitEventId,
      name: "峰会洽谈角",
      location: "主会场合页区",
    },
  });

  await prisma.meetingArea.upsert({
    where: { id: SEED_MTG.areas.innovation },
    update: { name: "创新交流区", location: "漕河泾会议中心 3F" },
    create: {
      id: SEED_MTG.areas.innovation,
      eventId: innovationSummitEventId,
      name: "创新交流区",
      location: "漕河泾会议中心 3F",
    },
  });

  const hostedATables = [
    { id: SEED_MTG.tables.hostedA01, name: "桌 01" },
    { id: SEED_MTG.tables.hostedA02, name: "桌 02" },
    { id: SEED_MTG.tables.hostedA03, name: "桌 03" },
    { id: SEED_MTG.tables.hostedA04, name: "桌 04" },
    { id: SEED_MTG.tables.hostedA05, name: "桌 05" },
    { id: SEED_MTG.tables.hostedA06, name: "桌 06" },
  ];
  for (const t of hostedATables) {
    await prisma.meetingTable.upsert({
      where: { id: t.id },
      update: { name: t.name, capacity: 2 },
      create: {
        id: t.id,
        areaId: SEED_MTG.areas.hostedNegotiation,
        name: t.name,
        capacity: 2,
      },
    });
  }

  const hostedBTables = [
    { id: SEED_MTG.tables.hostedB01, name: "桌 01" },
    { id: SEED_MTG.tables.hostedB02, name: "桌 02" },
    { id: SEED_MTG.tables.hostedB03, name: "桌 03" },
    { id: SEED_MTG.tables.hostedB04, name: "桌 04" },
  ];
  for (const t of hostedBTables) {
    await prisma.meetingTable.upsert({
      where: { id: t.id },
      update: { name: t.name, capacity: 4 },
      create: {
        id: t.id,
        areaId: SEED_MTG.areas.hostedVip,
        name: t.name,
        capacity: 4,
      },
    });
  }

  for (const [idx, id] of [
    SEED_MTG.tables.summit01,
    SEED_MTG.tables.summit02,
    SEED_MTG.tables.summit03,
  ].entries()) {
    await prisma.meetingTable.upsert({
      where: { id },
      update: { name: `桌 ${String(idx + 1).padStart(2, "0")}`, capacity: 2 },
      create: {
        id,
        areaId: SEED_MTG.areas.summit,
        name: `桌 ${String(idx + 1).padStart(2, "0")}`,
        capacity: 2,
      },
    });
  }

  for (const [idx, id] of [
    SEED_MTG.tables.innovation01,
    SEED_MTG.tables.innovation02,
  ].entries()) {
    await prisma.meetingTable.upsert({
      where: { id },
      update: { name: `桌 ${String(idx + 1).padStart(2, "0")}`, capacity: 2 },
      create: {
        id,
        areaId: SEED_MTG.areas.innovation,
        name: `桌 ${String(idx + 1).padStart(2, "0")}`,
        capacity: 2,
      },
    });
  }
}

type MeetingSeedRow = {
  id: string;
  eventId: string;
  requesterId: string;
  recipientId: string;
  status: MeetingStatus;
  scheduledStart: Date;
  scheduledEnd: Date;
  tableId?: string | null;
  fromAiMatch?: boolean;
  aiMatchScore?: number;
  wechatExchanged?: boolean;
  message?: string;
  respondedAt?: Date | null;
};

async function upsertMeetingRow(row: MeetingSeedRow) {
  await prisma.meeting.upsert({
    where: { id: row.id },
    update: {
      status: row.status,
      scheduledStart: row.scheduledStart,
      scheduledEnd: row.scheduledEnd,
      tableId: row.tableId ?? null,
      fromAiMatch: row.fromAiMatch ?? false,
      aiMatchScore: row.aiMatchScore ?? null,
      wechatExchanged: row.wechatExchanged ?? false,
      message: row.message ?? null,
      respondedAt: row.respondedAt ?? null,
    },
    create: {
      id: row.id,
      eventId: row.eventId,
      requesterId: row.requesterId,
      recipientId: row.recipientId,
      status: row.status,
      scheduledStart: row.scheduledStart,
      scheduledEnd: row.scheduledEnd,
      tableId: row.tableId ?? null,
      fromAiMatch: row.fromAiMatch ?? false,
      aiMatchScore: row.aiMatchScore ?? null,
      wechatExchanged: row.wechatExchanged ?? false,
      message: row.message ?? null,
      respondedAt: row.respondedAt ?? null,
    },
  });
}

async function seedScheduledMeetings(
  ctx: SeedMeetingsContext,
  baseDates: { hosted: Date; summit: Date; innovation: Date },
) {
  const users = ctx.endUserIds;
  const u = (i: number) => users[i];
  if (users.length < 10) {
    throw new Error("seed-meetings 需要至少 10 个 END_USER");
  }

  const hosted = baseDates.hosted;
  const summit = baseDates.summit;
  const innovation = baseDates.innovation;

  const hostedRows: MeetingSeedRow[] = [
    {
      id: SEED_MTG.meetings[0]!,
      eventId: ctx.hostedExpoEventId,
      requesterId: u(0)!,
      recipientId: u(1)!,
      status: MeetingStatus.ACCEPTED,
      ...slotOnDate(hosted, 10, 0),
      tableId: SEED_MTG.tables.hostedA01,
      fromAiMatch: true,
      aiMatchScore: 91,
      message: "AI 推荐：ERP 供需匹配",
      respondedAt: new Date(),
    },
    {
      id: SEED_MTG.meetings[1]!,
      eventId: ctx.hostedExpoEventId,
      requesterId: u(2)!,
      recipientId: u(3)!,
      status: MeetingStatus.ACCEPTED,
      ...slotOnDate(hosted, 10, 25),
      tableId: SEED_MTG.tables.hostedA02,
      respondedAt: new Date(),
    },
    {
      id: SEED_MTG.meetings[2]!,
      eventId: ctx.hostedExpoEventId,
      requesterId: u(4)!,
      recipientId: u(5)!,
      status: MeetingStatus.ACCEPTED,
      ...slotOnDate(hosted, 10, 50),
      tableId: SEED_MTG.tables.hostedA03,
      respondedAt: new Date(),
    },
    {
      id: SEED_MTG.meetings[3]!,
      eventId: ctx.hostedExpoEventId,
      requesterId: u(6)!,
      recipientId: u(7)!,
      status: MeetingStatus.COMPLETED,
      ...slotOnDate(hosted, 11, 15),
      tableId: SEED_MTG.tables.hostedA04,
      wechatExchanged: true,
      respondedAt: slotOnDate(hosted, 11, 15).start,
    },
    {
      id: SEED_MTG.meetings[4]!,
      eventId: ctx.hostedExpoEventId,
      requesterId: u(8)!,
      recipientId: u(9)!,
      status: MeetingStatus.NO_SHOW,
      ...slotOnDate(hosted, 11, 40),
      tableId: SEED_MTG.tables.hostedA05,
      respondedAt: slotOnDate(hosted, 11, 40).start,
    },
    {
      id: SEED_MTG.meetings[5]!,
      eventId: ctx.hostedExpoEventId,
      requesterId: u(1)!,
      recipientId: u(4)!,
      status: MeetingStatus.ACCEPTED,
      ...slotOnDate(hosted, 14, 0),
      tableId: SEED_MTG.tables.hostedB01,
      fromAiMatch: true,
      aiMatchScore: 86,
      respondedAt: new Date(),
    },
    {
      id: SEED_MTG.meetings[6]!,
      eventId: ctx.hostedExpoEventId,
      requesterId: u(5)!,
      recipientId: u(6)!,
      status: MeetingStatus.ACCEPTED,
      ...slotOnDate(hosted, 14, 25),
      tableId: SEED_MTG.tables.hostedB02,
      respondedAt: new Date(),
    },
    {
      id: SEED_MTG.meetings[7]!,
      eventId: ctx.hostedExpoEventId,
      requesterId: u(7)!,
      recipientId: u(8)!,
      status: MeetingStatus.PENDING,
      ...slotOnDate(hosted, 14, 50),
      tableId: SEED_MTG.tables.hostedB03,
      message: "待确认：MarTech 合作洽谈",
    },
    {
      id: SEED_MTG.meetings[8]!,
      eventId: ctx.hostedExpoEventId,
      requesterId: u(0)!,
      recipientId: u(2)!,
      status: MeetingStatus.ACCEPTED,
      ...slotOnDate(hosted, 10, 10, 20),
      tableId: SEED_MTG.tables.hostedA01,
      message: "⚠️ 演示冲突：与 10:00 场次桌位重叠",
      respondedAt: new Date(),
    },
    {
      id: SEED_MTG.meetings[9]!,
      eventId: ctx.hostedExpoEventId,
      requesterId: u(3)!,
      recipientId: u(5)!,
      status: MeetingStatus.ACCEPTED,
      ...slotOnDate(hosted, 10, 15, 20),
      tableId: SEED_MTG.tables.hostedA01,
      message: "⚠️ 演示冲突：同桌第三场重叠",
      respondedAt: new Date(),
    },
    {
      id: SEED_MTG.meetings[10]!,
      eventId: ctx.saasSummitEventId,
      requesterId: u(0)!,
      recipientId: u(2)!,
      status: MeetingStatus.ACCEPTED,
      ...slotOnDate(summit, 10, 0),
      tableId: SEED_MTG.tables.summit01,
      fromAiMatch: true,
      aiMatchScore: 88,
      respondedAt: new Date(),
    },
    {
      id: SEED_MTG.meetings[11]!,
      eventId: ctx.saasSummitEventId,
      requesterId: u(1)!,
      recipientId: u(3)!,
      status: MeetingStatus.ACCEPTED,
      ...slotOnDate(summit, 10, 25),
      tableId: SEED_MTG.tables.summit02,
      respondedAt: new Date(),
    },
  ];

  for (const row of hostedRows) {
    await upsertMeetingRow(row);
  }

  // 对齐 seed-event-features 中的 3 条会面，绑定桌位与调度网格日期
  const featPatches: Array<{ id: string; data: Prisma.MeetingUpdateInput }> = [
    {
      id: FEAT_MEETING_IDS[0],
      data: {
        scheduledStart: slotOnDate(summit, 14, 0).start,
        scheduledEnd: slotOnDate(summit, 14, 0).end,
        tableId: SEED_MTG.tables.summit03,
        fromAiMatch: true,
        aiMatchScore: 88,
        status: MeetingStatus.ACCEPTED,
      },
    },
    {
      id: FEAT_MEETING_IDS[1],
      data: {
        scheduledStart: slotOnDate(hosted, 11, 40).start,
        scheduledEnd: slotOnDate(hosted, 11, 40).end,
        tableId: SEED_MTG.tables.hostedA06,
        status: MeetingStatus.COMPLETED,
        wechatExchanged: true,
        message: "展位合作后续跟进",
        respondedAt: slotOnDate(hosted, 11, 40).start,
      },
    },
    {
      id: FEAT_MEETING_IDS[2],
      data: {
        scheduledStart: slotOnDate(innovation, 10, 25).start,
        scheduledEnd: slotOnDate(innovation, 10, 25).end,
        tableId: SEED_MTG.tables.innovation01,
        status: MeetingStatus.PENDING,
        message: "想聊聊活动数字化合作机会",
      },
    },
  ];

  for (const patch of featPatches) {
    await prisma.meeting.updateMany({
      where: { id: patch.id },
      data: patch.data,
    });
  }
}

async function seedUserEventIntents(ctx: SeedMeetingsContext) {
  const users = ctx.endUserIds;
  const u = (i: number) => users[i];
  if (users.length < 8) return;

  const specs = [
    {
      id: SEED_MTG.intents[0]!,
      eventId: ctx.hostedExpoEventId,
      userId: u(0)!,
      role: "采购",
      supplyTags: ["ERP 实施经验"],
      demandTags: ["智能制造方案", "MES 系统"],
      topics: ["工业 4.0", "产线数字化"],
    },
    {
      id: SEED_MTG.intents[1]!,
      eventId: ctx.hostedExpoEventId,
      userId: u(1)!,
      role: "合作",
      supplyTags: ["MarTech 工具", "活动运营"],
      demandTags: ["B2B 获客"],
      topics: ["私域运营"],
    },
    {
      id: SEED_MTG.intents[2]!,
      eventId: ctx.hostedExpoEventId,
      userId: u(2)!,
      role: "销售",
      supplyTags: ["会展 SaaS", "签到系统"],
      demandTags: ["大型展会主办方"],
      topics: ["活动科技"],
    },
    {
      id: SEED_MTG.intents[3]!,
      eventId: ctx.hostedExpoEventId,
      userId: u(3)!,
      role: "投资",
      supplyTags: ["产业基金"],
      demandTags: ["A 轮 SaaS", "工业软件"],
      topics: ["企业服务投资"],
    },
    {
      id: SEED_MTG.intents[4]!,
      eventId: ctx.hostedExpoEventId,
      userId: u(4)!,
      role: "采购",
      supplyTags: ["供应链资源"],
      demandTags: ["自动化设备"],
      topics: ["智能制造"],
    },
    {
      id: SEED_MTG.intents[5]!,
      eventId: ctx.hostedExpoEventId,
      userId: u(5)!,
      role: "学习交流",
      supplyTags: ["数据分析"],
      demandTags: ["AI 落地案例"],
      topics: ["AI 落地"],
    },
    {
      id: SEED_MTG.intents[6]!,
      eventId: ctx.saasSummitEventId,
      userId: u(0)!,
      role: "销售",
      supplyTags: ["增长方法论"],
      demandTags: ["PLG 实践"],
      topics: ["B2B 增长"],
    },
    {
      id: SEED_MTG.intents[7]!,
      eventId: ctx.saasSummitEventId,
      userId: u(1)!,
      role: "合作",
      supplyTags: ["渠道资源"],
      demandTags: ["SaaS 联名活动"],
      topics: ["渠道合作"],
    },
  ];

  for (const row of specs) {
    await prisma.userEventIntent.upsert({
      where: { userId_eventId: { userId: row.userId, eventId: row.eventId } },
      update: {
        role: row.role,
        supplyTags: row.supplyTags,
        demandTags: row.demandTags,
        topics: row.topics,
      },
      create: {
        id: row.id,
        userId: row.userId,
        eventId: row.eventId,
        role: row.role,
        supplyTags: row.supplyTags,
        demandTags: row.demandTags,
        topics: row.topics,
      },
    });
  }
}

export async function seedMeetingDemoData(ctx: SeedMeetingsContext) {
  await clearSeedMeetingData();

  const events = await prisma.event.findMany({
    where: {
      id: {
        in: [
          ctx.hostedExpoEventId,
          ctx.saasSummitEventId,
          ctx.innovationSummitEventId,
        ],
      },
    },
    select: { id: true, startDate: true },
  });
  const startById = new Map(events.map((e) => [e.id, e.startDate]));

  await Promise.all([
    enableMeetingFeatures(ctx.hostedExpoEventId, { premeet: true }),
    enableMeetingFeatures(ctx.saasSummitEventId),
    enableMeetingFeatures(ctx.innovationSummitEventId),
  ]);

  await Promise.all([
    upsertMeetingTimeWindows(ctx.hostedExpoEventId),
    upsertMeetingTimeWindows(ctx.saasSummitEventId),
    upsertMeetingTimeWindows(ctx.innovationSummitEventId),
  ]);

  await seedMeetingAreasAndTables(ctx);

  const baseDates = {
    hosted: resolveScheduleBaseDate(startById.get(ctx.hostedExpoEventId) ?? null),
    summit: resolveScheduleBaseDate(startById.get(ctx.saasSummitEventId) ?? null),
    innovation: resolveScheduleBaseDate(
      startById.get(ctx.innovationSummitEventId) ?? null,
    ),
  };

  await seedScheduledMeetings(ctx, baseDates);
  await seedUserEventIntents(ctx);

  const tableCount = Object.keys(SEED_MTG.tables).length;
  const meetingCount =
    SEED_MTG.meetings.length +
    FEAT_MEETING_IDS.length;

  return {
    tableCount,
    meetingCount,
    intentCount: SEED_MTG.intents.length,
    hostedAreaCount: 2,
    conflictMeetingIds: [
      SEED_MTG.meetings[8],
      SEED_MTG.meetings[9],
    ],
  };
}
