import { prisma } from "@connectiq/database";
import type { Prisma } from "@connectiq/database";
import { ErrorCode } from "@connectiq/types";
import { z } from "zod";
import {
  createErrorResponse,
  createSuccessResponse,
  requireEventAccess,
  withErrorHandler,
} from "@/lib/api-auth";
import {
  resolveCompanyOrgId,
  withLegacyExhibitor,
} from "@/lib/exhibitor-booth-utils";
import { getPublicBoothDetail } from "@/lib/mobile-booth-service";
import {
  countBoothStaffByEvent,
  resolveBoothStaffMaxCount,
} from "@/lib/exhibitor/booth-staff-service";
import { assertHallLabelAllowed } from "@/lib/expo-settings-service";

const positionSchema = z.object({
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
  width: z.number().min(1).max(100),
  height: z.number().min(1).max(100),
  area: z.number().optional(),
});

const updateBoothSchema = z.object({
  name: z.string().optional(),
  code: z.string().optional(),
  exhibitorId: z.string().optional(),
  status: z.enum(["AVAILABLE", "BOOKED", "OCCUPIED"]).optional(),
  positionData: positionSchema.nullable().optional(),
  leadFormConfig: z.record(z.unknown()).optional(),
  maxStaffCount: z.number().int().min(1).max(99).optional(),
  hallLabel: z.string().max(64).nullable().optional(),
});

/** 展位详情（参会者，无需登录） */
export const GET = withErrorHandler(async (_request, context) => {
  const eventId = context?.params?.eventId;
  const boothId = context?.params?.boothId;
  if (!eventId || !boothId) {
    return createErrorResponse("参数缺失", ErrorCode.VALIDATION_ERROR, 400);
  }

  const data = await getPublicBoothDetail(boothId);
  if (data.eventId !== eventId) {
    return createErrorResponse("展位不属于该活动", ErrorCode.NOT_FOUND, 404);
  }

  return createSuccessResponse(data);
});

export const PATCH = withErrorHandler(async (request, context) => {
  const eventId = context?.params?.eventId;
  const boothId = context?.params?.boothId;
  if (!eventId || !boothId) {
    return createErrorResponse("参数缺失", ErrorCode.VALIDATION_ERROR, 400);
  }

  await requireEventAccess(eventId);
  const body = await request.json();
  const parsed = updateBoothSchema.safeParse(body);
  if (!parsed.success) {
    return createErrorResponse("参数错误", ErrorCode.VALIDATION_ERROR, 400);
  }

  const booth = await prisma.exhibitorBooth.findFirst({
    where: { id: boothId, eventId },
  });
  if (!booth) {
    return createErrorResponse("展位不存在", ErrorCode.NOT_FOUND, 404);
  }

  if (parsed.data.maxStaffCount != null) {
    const staffCounts = await countBoothStaffByEvent(eventId);
    const currentCount = staffCounts.get(boothId) ?? 0;
    const newMax = parsed.data.maxStaffCount + booth.extraStaffPurchased;
    if (currentCount > newMax) {
      return createErrorResponse(
        `当前已有 ${currentCount} 位工作人员，名额上限不能低于已使用数量`,
        ErrorCode.VALIDATION_ERROR,
        400,
      );
    }
  }

  if (parsed.data.hallLabel !== undefined) {
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
  }

  let companyOrgId: string | undefined;
  if (parsed.data.exhibitorId) {
    const resolved = await resolveCompanyOrgId(parsed.data.exhibitorId);
    if (!resolved) {
      return createErrorResponse("未找到展商组织", ErrorCode.VALIDATION_ERROR, 400);
    }
    companyOrgId = resolved;
  }

  const updated = await prisma.exhibitorBooth.update({
    where: { id: boothId },
    data: {
      name: parsed.data.name,
      code: parsed.data.code,
      ...(companyOrgId !== undefined ? { companyOrgId } : {}),
      status: parsed.data.status,
      positionData:
        parsed.data.positionData === undefined
          ? undefined
          : (parsed.data.positionData as Prisma.InputJsonValue),
      leadFormConfig: parsed.data.leadFormConfig as
        | Prisma.InputJsonValue
        | undefined,
      maxStaffCount: parsed.data.maxStaffCount,
      hallLabel: parsed.data.hallLabel,
    },
    include: {
      companyOrg: { select: { id: true, name: true } },
      _count: { select: { leads: true } },
    },
  });

  const staffCounts = await countBoothStaffByEvent(eventId);
  const maxCount = resolveBoothStaffMaxCount(updated);
  const currentCount = staffCounts.get(boothId) ?? 0;

  return createSuccessResponse({
    ...withLegacyExhibitor(updated),
    maxStaffCount: updated.maxStaffCount,
    extraStaffPurchased: updated.extraStaffPurchased,
    staffQuota: {
      currentCount,
      maxCount,
      remainingSlots: Math.max(0, maxCount - currentCount),
      isFull: maxCount > 0 && currentCount >= maxCount,
    },
  });
});

export const DELETE = withErrorHandler(async (_request, context) => {
  const eventId = context?.params?.eventId;
  const boothId = context?.params?.boothId;
  if (!eventId || !boothId) {
    return createErrorResponse("参数缺失", ErrorCode.VALIDATION_ERROR, 400);
  }

  await requireEventAccess(eventId);

  const booth = await prisma.exhibitorBooth.findFirst({
    where: { id: boothId, eventId },
  });
  if (!booth) {
    return createErrorResponse("展位不存在", ErrorCode.NOT_FOUND, 404);
  }

  await prisma.exhibitorBooth.delete({ where: { id: boothId } });
  return createSuccessResponse({ deleted: true });
});
