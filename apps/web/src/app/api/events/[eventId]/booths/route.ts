import { prisma, type Prisma } from "@connectiq/database";
import { ErrorCode } from "@connectiq/types";
import { z } from "zod";
import {
  createErrorResponse,
  createSuccessResponse,
  requireEventAccess,
  withErrorHandler,
} from "@/lib/api-auth";
import { classifyLeadGrade } from "@/lib/booth-map";
import type { MapLabel, MapPoi } from "@/types/booth";

const positionSchema = z.object({
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
  width: z.number().min(1).max(100),
  height: z.number().min(1).max(100),
  area: z.number().optional(),
});

const createBoothSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1),
  exhibitorId: z.string().optional(),
  hallId: z.string().optional(),
  status: z.enum(["AVAILABLE", "BOOKED", "OCCUPIED"]).optional(),
  positionData: positionSchema.optional(),
});

const updateBoothSchema = z.object({
  name: z.string().optional(),
  code: z.string().optional(),
  exhibitorId: z.string().optional(),
  status: z.enum(["AVAILABLE", "BOOKED", "OCCUPIED"]).optional(),
  positionData: positionSchema.nullable().optional(),
  leadFormConfig: z.record(z.unknown()).optional(),
});

function parseJsonSetting<T>(value: unknown, fallback: T): T {
  if (Array.isArray(value)) return value as T;
  return fallback;
}

async function getBoothStats(eventId: string) {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const leads = await prisma.lead.findMany({
    where: { booth: { eventId } },
    select: {
      boothId: true,
      createdAt: true,
      status: true,
      intentTags: {
        select: { intentTag: { select: { label: true } } },
      },
    },
  });

  const statsByBooth = new Map<
    string,
    { todayVisitors: number; gradeA: number; crmSynced: number }
  >();

  for (const lead of leads) {
    const current = statsByBooth.get(lead.boothId) ?? {
      todayVisitors: 0,
      gradeA: 0,
      crmSynced: 0,
    };

    if (lead.createdAt >= todayStart) {
      current.todayVisitors += 1;
    }

    const label = lead.intentTags[0]?.intentTag.label ?? "";
    if (classifyLeadGrade(label) === "A") {
      current.gradeA += 1;
    }

    if (["CONTACTED", "QUALIFIED", "WON"].includes(lead.status)) {
      current.crmSynced += 1;
    }

    statsByBooth.set(lead.boothId, current);
  }

  return statsByBooth;
}

export const GET = withErrorHandler(async (_request, context) => {
  const eventId = context?.params?.eventId;
  if (!eventId) {
    return createErrorResponse("缺少活动 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  await requireEventAccess(eventId);

  const [booths, settings, exhibitors, statsByBooth] = await Promise.all([
    prisma.booth.findMany({
      where: { eventId },
      include: {
        exhibitor: { select: { id: true, name: true, email: true } },
        _count: { select: { leads: true } },
      },
      orderBy: { code: "asc" },
    }),
    prisma.eventSetting.findMany({
      where: {
        eventId,
        key: { in: ["floor_plan_url", "floor_plan_pois", "floor_plan_labels"] },
      },
    }),
    prisma.user.findMany({
      where: {
        roleAssignments: { some: { role: "EXHIBITOR" } },
      },
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
    }),
    getBoothStats(eventId),
  ]);

  const settingMap = Object.fromEntries(settings.map((s) => [s.key, s.value]));
  const floorPlanUrl =
    typeof settingMap.floor_plan_url === "string"
      ? settingMap.floor_plan_url
      : null;
  const pois = parseJsonSetting<MapPoi[]>(settingMap.floor_plan_pois, []);
  const labels = parseJsonSetting<MapLabel[]>(settingMap.floor_plan_labels, []);

  const boothsWithStats = booths.map((booth) => ({
    ...booth,
    stats: statsByBooth.get(booth.id) ?? {
      todayVisitors: 0,
      gradeA: 0,
      crmSynced: 0,
    },
  }));

  return createSuccessResponse({
    booths: boothsWithStats,
    floorPlanUrl,
    pois,
    labels,
    exhibitors,
  });
});

export const POST = withErrorHandler(async (request, context) => {
  const eventId = context?.params?.eventId;
  if (!eventId) {
    return createErrorResponse("缺少活动 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  await requireEventAccess(eventId);

  const body = await request.json();
  const parsed = createBoothSchema.safeParse(body);
  if (!parsed.success) {
    return createErrorResponse(
      parsed.error.issues[0]?.message ?? "参数错误",
      ErrorCode.VALIDATION_ERROR,
      400,
    );
  }

  const exhibitorId =
    parsed.data.exhibitorId ??
    (
      await prisma.user.findFirst({
        where: {
          roleAssignments: {
            some: { role: "EXHIBITOR" },
          },
        },
        select: { id: true },
      })
    )?.id;

  if (!exhibitorId) {
    return createErrorResponse("未找到可用展商", ErrorCode.VALIDATION_ERROR, 400);
  }

  const booth = await prisma.booth.create({
    data: {
      eventId,
      name: parsed.data.name,
      code: parsed.data.code,
      exhibitorId,
      hallId: parsed.data.hallId,
      status: parsed.data.status ?? "AVAILABLE",
      positionData: parsed.data.positionData as Prisma.InputJsonValue | undefined,
    },
    include: {
      exhibitor: { select: { id: true, name: true, email: true } },
      _count: { select: { leads: true } },
    },
  });

  return createSuccessResponse({
    ...booth,
    stats: { todayVisitors: 0, gradeA: 0, crmSynced: 0 },
  });
});

export const PATCH = withErrorHandler(async (request, context) => {
  const eventId = context?.params?.eventId;
  if (!eventId) {
    return createErrorResponse("缺少活动 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  await requireEventAccess(eventId);
  const body = await request.json();

  if (body.floorPlanUrl != null) {
    await prisma.eventSetting.upsert({
      where: { eventId_key: { eventId, key: "floor_plan_url" } },
      create: { eventId, key: "floor_plan_url", value: body.floorPlanUrl },
      update: { value: body.floorPlanUrl },
    });
    return createSuccessResponse({ floorPlanUrl: body.floorPlanUrl });
  }

  if (body.pois != null) {
    await prisma.eventSetting.upsert({
      where: { eventId_key: { eventId, key: "floor_plan_pois" } },
      create: { eventId, key: "floor_plan_pois", value: body.pois },
      update: { value: body.pois },
    });
    return createSuccessResponse({ pois: body.pois });
  }

  if (body.labels != null) {
    await prisma.eventSetting.upsert({
      where: { eventId_key: { eventId, key: "floor_plan_labels" } },
      create: { eventId, key: "floor_plan_labels", value: body.labels },
      update: { value: body.labels },
    });
    return createSuccessResponse({ labels: body.labels });
  }

  return createErrorResponse("无效请求", ErrorCode.VALIDATION_ERROR, 400);
});
