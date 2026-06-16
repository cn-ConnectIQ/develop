import { prisma, type Prisma } from "@connectiq/database";
import { ErrorCode } from "@connectiq/types";
import { z } from "zod";
import {
  createErrorResponse,
  createSuccessResponse,
  requireEventAccess,
  withErrorHandler,
} from "@/lib/api-auth";
import {
  getExternalSync,
  parseFieldMap,
  parseSyncConfig,
  upsertExternalSync,
} from "@/lib/external-sync";
import { normalizeLeadFormConfig } from "@/lib/form-config";
import { withLegacyExhibitor } from "@/lib/exhibitor-booth-utils";
import type { MarketupSyncConfig } from "@/types/booth";

const formConfigSchema = z.object({
  leadFormConfig: z.record(z.unknown()),
  applyToAll: z.boolean().optional(),
  saveAsTemplate: z.boolean().optional(),
});

export const GET = withErrorHandler(async (_request, context) => {
  const eventId = context?.params?.eventId;
  const boothId = context?.params?.boothId;
  if (!eventId || !boothId) {
    return createErrorResponse("参数缺失", ErrorCode.VALIDATION_ERROR, 400);
  }

  await requireEventAccess(eventId);

  const [booth, booths, externalSync, templateSetting] = await Promise.all([
    prisma.exhibitorBooth.findFirst({
      where: { id: boothId, eventId },
      select: {
        id: true,
        code: true,
        name: true,
        leadFormConfig: true,
        companyOrg: { select: { id: true, name: true } },
      },
    }),
    prisma.exhibitorBooth.findMany({
      where: { eventId },
      select: {
        id: true,
        code: true,
        name: true,
        companyOrg: { select: { id: true, name: true } },
      },
      orderBy: { code: "asc" },
    }),
    getExternalSync(eventId),
    prisma.eventSetting.findUnique({
      where: { eventId_key: { eventId, key: "lead_form_template" } },
    }),
  ]);

  if (!booth) {
    return createErrorResponse("展位不存在", ErrorCode.NOT_FOUND, 404);
  }

  return createSuccessResponse({
    booth: {
      ...withLegacyExhibitor(booth),
      leadFormConfig: normalizeLeadFormConfig(booth.leadFormConfig),
    },
    booths: booths.map(withLegacyExhibitor),
    externalSync: {
      fieldMap: parseFieldMap(externalSync.fieldMap),
      syncConfig: parseSyncConfig(externalSync.syncConfig),
    },
    template: templateSetting?.value
      ? normalizeLeadFormConfig(templateSetting.value)
      : null,
  });
});

export const PATCH = withErrorHandler(async (request, context) => {
  const eventId = context?.params?.eventId;
  const boothId = context?.params?.boothId;
  if (!eventId || !boothId) {
    return createErrorResponse("参数缺失", ErrorCode.VALIDATION_ERROR, 400);
  }

  await requireEventAccess(eventId);
  const body = await request.json();
  const parsed = formConfigSchema.safeParse(body);
  if (!parsed.success) {
    return createErrorResponse("参数错误", ErrorCode.VALIDATION_ERROR, 400);
  }

  const config = parsed.data.leadFormConfig as Prisma.InputJsonValue;

  if (parsed.data.saveAsTemplate) {
    await prisma.eventSetting.upsert({
      where: { eventId_key: { eventId, key: "lead_form_template" } },
      create: {
        eventId,
        key: "lead_form_template",
        value: config,
      },
      update: { value: config },
    });
    return createSuccessResponse({ savedAsTemplate: true });
  }

  if (parsed.data.applyToAll) {
    await prisma.exhibitorBooth.updateMany({
      where: { eventId },
      data: { leadFormConfig: config },
    });
  } else {
    const exists = await prisma.exhibitorBooth.findFirst({
      where: { id: boothId, eventId },
    });
    if (!exists) {
      return createErrorResponse("展位不存在", ErrorCode.NOT_FOUND, 404);
    }
    await prisma.exhibitorBooth.update({
      where: { id: boothId },
      data: { leadFormConfig: config },
    });
  }

  return createSuccessResponse({ saved: true });
});
