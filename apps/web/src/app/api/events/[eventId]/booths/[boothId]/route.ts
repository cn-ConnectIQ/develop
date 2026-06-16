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
    },
    include: {
      companyOrg: { select: { id: true, name: true } },
      _count: { select: { leads: true } },
    },
  });

  return createSuccessResponse(withLegacyExhibitor(updated));
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
