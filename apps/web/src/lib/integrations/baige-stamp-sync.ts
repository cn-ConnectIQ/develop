import {
  prisma,
  StampOwnerType,
  StampPointType,
  StampRallyStatus,
  type Prisma,
} from "@connectiq/database";
import {
  BAIGE_EVENT_ID_KEY,
  BAIGE_PROVIDER,
  BAIGE_STAMP_MAP_KEY,
  BAIGE_STAMP_RALLY_NAME,
} from "@/lib/integrations/baige-partner-constants";
import { assertStampPointQuota } from "@/lib/stamp/stamp-quota";

export class BaigeStampSyncError extends Error {
  constructor(
    message: string,
    public code: string,
  ) {
    super(message);
  }
}

export type BaigeCollectionPoint = {
  pointId: string;
  name: string;
  location?: string | null;
  sortOrder?: number;
  scanCode?: string | null;
};

async function resolveEventId(input: {
  eventId?: string | null;
  baigeEventId?: string | null;
}) {
  if (input.eventId) {
    const event = await prisma.event.findUnique({
      where: { id: input.eventId },
      select: { id: true, organizerId: true },
    });
    if (!event) {
      throw new BaigeStampSyncError("未找到对应玖莅活动", "EVENT_NOT_FOUND");
    }
    return event;
  }
  const baigeEventId = input.baigeEventId?.trim();
  if (!baigeEventId) {
    throw new BaigeStampSyncError("缺少 eventId / baigeEventId", "VALIDATION");
  }
  const byRef = await prisma.event.findFirst({
    where: { externalRefId: baigeEventId, dataSource: "BAGEVENT" },
    select: { id: true, organizerId: true },
  });
  if (byRef) return byRef;

  const setting = await prisma.eventSetting.findFirst({
    where: {
      key: BAIGE_EVENT_ID_KEY,
      value: { equals: baigeEventId },
    },
    select: { eventId: true },
  });
  if (!setting) {
    throw new BaigeStampSyncError("未找到对应玖莅活动", "EVENT_NOT_FOUND");
  }
  const event = await prisma.event.findUnique({
    where: { id: setting.eventId },
    select: { id: true, organizerId: true },
  });
  if (!event) {
    throw new BaigeStampSyncError("未找到对应玖莅活动", "EVENT_NOT_FOUND");
  }
  return event;
}

async function loadStampMap(eventId: string) {
  const row = await prisma.eventSetting.findUnique({
    where: { eventId_key: { eventId, key: BAIGE_STAMP_MAP_KEY } },
  });
  if (!row?.value || typeof row.value !== "object" || Array.isArray(row.value)) {
    return {} as Record<string, string>;
  }
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(row.value as Record<string, unknown>)) {
    if (typeof v === "string" && v.trim()) out[k] = v.trim();
  }
  return out;
}

async function saveStampMap(eventId: string, map: Record<string, string>) {
  await prisma.eventSetting.upsert({
    where: { eventId_key: { eventId, key: BAIGE_STAMP_MAP_KEY } },
    create: {
      eventId,
      key: BAIGE_STAMP_MAP_KEY,
      value: map as Prisma.InputJsonValue,
    },
    update: { value: map as Prisma.InputJsonValue },
  });
}

async function ensureBaigeStampRally(eventId: string, createdById: string) {
  const existing = await prisma.stampRally.findFirst({
    where: {
      eventId,
      ownerType: StampOwnerType.ORGANIZER,
      name: BAIGE_STAMP_RALLY_NAME,
    },
  });
  if (existing) return existing;

  return prisma.stampRally.create({
    data: {
      eventId,
      createdById,
      ownerType: StampOwnerType.ORGANIZER,
      name: BAIGE_STAMP_RALLY_NAME,
      description: "由百格采集点自动同步",
      prize: "完成采集",
      requiredCount: 1,
      status: StampRallyStatus.ACTIVE,
    },
  });
}

/** 百格采集点配置 → Stamp（幂等按 pointId） */
export async function syncBaigeCollectionPoints(input: {
  eventId?: string | null;
  baigeEventId?: string | null;
  points: BaigeCollectionPoint[];
  actorUserId?: string | null;
}) {
  const event = await resolveEventId(input);
  const eventId = event.id;
  const createdById = input.actorUserId || event.organizerId;

  const rally = await ensureBaigeStampRally(eventId, createdById);
  const map = await loadStampMap(eventId);

  const newPointCount = input.points.filter((point) => {
    const pointId = point.pointId.trim();
    return pointId && point.name.trim() && !map[pointId];
  }).length;
  await assertStampPointQuota(eventId, newPointCount);

  let created = 0;
  let updated = 0;

  for (const [index, point] of input.points.entries()) {
    const pointId = point.pointId.trim();
    if (!pointId || !point.name.trim()) continue;

    const existingStampId = map[pointId];
    if (existingStampId) {
      await prisma.stamp.update({
        where: { id: existingStampId },
        data: {
          name: point.name.trim(),
          customName: pointId,
          location: point.location?.trim() || null,
          sortOrder: point.sortOrder ?? index,
          ...(point.scanCode?.trim()
            ? { scanCode: point.scanCode.trim() }
            : {}),
        },
      });
      updated += 1;
      continue;
    }

    const stamp = await prisma.stamp.create({
      data: {
        rallyId: rally.id,
        name: point.name.trim(),
        pointType: StampPointType.CUSTOM,
        customName: pointId,
        location: point.location?.trim() || null,
        sortOrder: point.sortOrder ?? index,
        ...(point.scanCode?.trim() ? { scanCode: point.scanCode.trim() } : {}),
      },
    });
    map[pointId] = stamp.id;
    created += 1;
  }

  const requiredCount = Math.max(1, Object.keys(map).length);
  await prisma.stampRally.update({
    where: { id: rally.id },
    data: { requiredCount },
  });
  await saveStampMap(eventId, map);

  // 标记来源，便于列表识别
  await prisma.event.update({
    where: { id: eventId },
    data: { dataSource: "BAGEVENT" },
  });

  void BAIGE_PROVIDER;

  return {
    eventId,
    rallyId: rally.id,
    created,
    updated,
    totalMapped: Object.keys(map).length,
  };
}
