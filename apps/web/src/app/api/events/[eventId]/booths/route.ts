import { BillingLedgerResource, prisma, type Prisma } from "@connectiq/database";
import { ErrorCode } from "@connectiq/types";
import { z } from "zod";
import {
  createErrorResponse,
  createSuccessResponse,
  requireEventAccess,
  withErrorHandler,
} from "@/lib/api-auth";
import { assertAndDebitInteractionPoint } from "@/lib/billing/billing-guards";
import { creditOrgWallet } from "@/lib/billing/wallet-service";
import { classifyLeadGrade } from "@/lib/booth-map";
import {
  withLegacyExhibitor,
} from "@/lib/exhibitor-booth-utils";
import {
  listAssignableExhibitorsForEvent,
  resolveExhibitorForHostBooth,
} from "@/lib/host-exhibitor-directory-service";
import {
  countBoothStaffByEvent,
  resolveBoothStaffMaxCount,
} from "@/lib/exhibitor/booth-staff-service";
import { requireEventAccessMobileOrWeb } from "@/lib/mobile-event-access";
import { assertHallLabelAllowed } from "@/lib/expo-settings-service";
import type { MapLabel, MapPoi } from "@/types/booth";

const positionSchema = z.object({
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
  width: z.number().min(1).max(100),
  height: z.number().min(1).max(100),
  area: z.number().optional(),
});

const createBoothSchema = z
  .object({
    name: z.string().min(1),
    code: z.string().min(1),
    exhibitorId: z.string().optional(),
    exhibitorName: z.string().max(80).optional(),
    hallId: z.string().optional(),
    status: z.enum(["AVAILABLE", "BOOKED", "OCCUPIED"]).optional(),
    positionData: positionSchema.optional(),
    maxStaffCount: z.number().int().min(1).max(99).optional(),
    hallLabel: z.string().max(64).optional(),
  })
  .refine(
    (v) => Boolean(v.exhibitorId?.trim() || v.exhibitorName?.trim()),
    { message: "请选择已有展商，或填写新展商企业名称", path: ["exhibitorId"] },
  );

const updateBoothSchema = z.object({
  name: z.string().optional(),
  code: z.string().optional(),
  exhibitorId: z.string().optional(),
  exhibitorName: z.string().max(80).optional(),
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

export const GET = withErrorHandler(async (request, context) => {
  const eventId = context?.params?.eventId;
  if (!eventId) {
    return createErrorResponse("缺少活动 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  await requireEventAccessMobileOrWeb(request, eventId);

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { orgId: true },
  });
  if (!event?.orgId) {
    return createErrorResponse("活动未关联组织", ErrorCode.NOT_FOUND, 404);
  }

  const [booths, settings, exhibitors, statsByBooth, staffCountByBooth] =
    await Promise.all([
    prisma.exhibitorBooth.findMany({
      where: { eventId },
      include: {
        companyOrg: { select: { id: true, name: true, slug: true } },
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
    listAssignableExhibitorsForEvent(event.orgId, eventId),
    getBoothStats(eventId),
    countBoothStaffByEvent(eventId),
  ]);

  const settingMap = Object.fromEntries(settings.map((s) => [s.key, s.value]));
  const floorPlanUrl =
    typeof settingMap.floor_plan_url === "string"
      ? settingMap.floor_plan_url
      : null;
  const pois = parseJsonSetting<MapPoi[]>(settingMap.floor_plan_pois, []);
  const labels = parseJsonSetting<MapLabel[]>(settingMap.floor_plan_labels, []);

  const boothsWithStats = booths.map((booth) => {
    const maxCount = resolveBoothStaffMaxCount(booth);
    const currentCount = staffCountByBooth.get(booth.id) ?? 0;
    return {
      ...withLegacyExhibitor(booth),
      maxStaffCount: booth.maxStaffCount,
      extraStaffPurchased: booth.extraStaffPurchased,
      hallLabel: booth.hallLabel,
      staffQuota: {
        currentCount,
        maxCount,
        remainingSlots: Math.max(0, maxCount - currentCount),
        isFull: maxCount > 0 && currentCount >= maxCount,
      },
      stats: statsByBooth.get(booth.id) ?? {
        todayVisitors: 0,
        gradeA: 0,
        crmSynced: 0,
      },
    };
  });

  return createSuccessResponse({
    booths: boothsWithStats,
    floorPlanUrl,
    pois,
    labels,
    exhibitors: exhibitors.map((org) => ({
      id: org.id,
      name: org.name,
      email: org.slug
        ? `${org.slug}@org.connectiq.local`
        : `${org.id}@org.connectiq.local`,
      source: org.source,
    })),
  });
});

export const POST = withErrorHandler(async (request, context) => {
  const eventId = context?.params?.eventId;
  if (!eventId) {
    return createErrorResponse("缺少活动 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  const { session, event } = await requireEventAccess(eventId);

  const body = await request.json();
  const parsed = createBoothSchema.safeParse(body);
  if (!parsed.success) {
    return createErrorResponse(
      parsed.error.issues[0]?.message ?? "参数错误",
      ErrorCode.VALIDATION_ERROR,
      400,
    );
  }

  let companyOrgId: string;
  try {
    if (!event.orgId) {
      return createErrorResponse("活动未关联组织", ErrorCode.VALIDATION_ERROR, 400);
    }
    companyOrgId = await resolveExhibitorForHostBooth({
      hostOrgId: event.orgId,
      exhibitorId: parsed.data.exhibitorId,
      exhibitorName: parsed.data.exhibitorName,
    });
  } catch (err) {
    return createErrorResponse(
      err instanceof Error ? err.message : "展商信息无效",
      ErrorCode.VALIDATION_ERROR,
      400,
    );
  }

  const hallCheck = await assertHallLabelAllowed(
    eventId,
    parsed.data.hallLabel,
  );
  if (!hallCheck.ok) {
    return createErrorResponse(
      hallCheck.error,
      ErrorCode.VALIDATION_ERROR,
      400,
    );
  }

  const billingOrgId = event.orgId;
  let debited = false;
  if (billingOrgId) {
    try {
      await assertAndDebitInteractionPoint({
        orgId: billingOrgId,
        eventId,
        createdByUserId: session.user.id,
        remark: `开通展位 ${parsed.data.code}`,
      });
      debited = true;
    } catch (err) {
      return createErrorResponse(
        err instanceof Error ? err.message : "互动点不足",
        ErrorCode.FORBIDDEN,
        402,
      );
    }
  }

  let booth;
  try {
    booth = await prisma.exhibitorBooth.create({
      data: {
        eventId,
        name: parsed.data.name,
        code: parsed.data.code,
        companyOrgId,
        hallId: parsed.data.hallId,
        status: parsed.data.status ?? "AVAILABLE",
        positionData: parsed.data.positionData as Prisma.InputJsonValue | undefined,
        maxStaffCount: parsed.data.maxStaffCount ?? 2,
        hallLabel: parsed.data.hallLabel,
      },
      include: {
        companyOrg: { select: { id: true, name: true, slug: true } },
        _count: { select: { leads: true } },
      },
    });
  } catch (error) {
    if (debited && billingOrgId) {
      await creditOrgWallet({
        orgId: billingOrgId,
        resource: BillingLedgerResource.INTERACTION_POINT,
        amount: 1,
        eventId,
        createdByUserId: session.user.id,
        remark: `开通展位失败退回 ${parsed.data.code}`,
      }).catch(() => undefined);
    }
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code: string }).code === "P2002"
    ) {
      return createErrorResponse(
        "该活动下展位编号已存在",
        ErrorCode.VALIDATION_ERROR,
        409,
      );
    }
    throw error;
  }

  return createSuccessResponse({
    ...withLegacyExhibitor(booth),
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

  const batchParsed = z
    .object({
      batchMaxStaffCount: z.object({
        hallLabel: z.string().min(1),
        maxStaffCount: z.number().int().min(1).max(99),
      }),
    })
    .safeParse(body);

  if (batchParsed.success) {
    const { hallLabel, maxStaffCount } = batchParsed.data.batchMaxStaffCount;
    const hallCheck = await assertHallLabelAllowed(eventId, hallLabel);
    if (!hallCheck.ok) {
      return createErrorResponse(
        hallCheck.error,
        ErrorCode.VALIDATION_ERROR,
        400,
      );
    }
    const result = await prisma.exhibitorBooth.updateMany({
      where: { eventId, hallLabel },
      data: { maxStaffCount },
    });
    return createSuccessResponse({
      updated: result.count,
      hallLabel,
      maxStaffCount,
    });
  }

  return createErrorResponse("无效请求", ErrorCode.VALIDATION_ERROR, 400);
});
