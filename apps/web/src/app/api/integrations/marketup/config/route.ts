import { prisma, type Prisma } from "@connectiq/database";
import { ErrorCode, UserRole } from "@connectiq/types";
import { z } from "zod";
import {
  createErrorResponse,
  createSuccessResponse,
  requireAuth,
  withErrorHandler,
} from "@/lib/api-auth";
import {
  getPlatformMarketupConfig,
  savePlatformMarketupConfig,
} from "@/lib/marketup-sync";
import { parsePlatformSyncConfig } from "@/lib/marketup-config";
import type { MarketupSyncConfig } from "@/types/booth";

export const GET = withErrorHandler(async () => {
  await requireAuth([UserRole.PLATFORM_ADMIN, UserRole.ORGANIZER]);

  const platform = await getPlatformMarketupConfig();

  return createSuccessResponse({
    fieldMap: platform.fieldMap,
    config: platform.config,
  });
});

const patchSchema = z.object({
  fieldMap: z.record(z.string()).optional(),
  config: z
    .object({
      writeStrategy: z.enum(["create_only", "upsert"]).optional(),
      conflictPolicy: z.enum(["connectiq", "marketup"]).optional(),
      triggers: z
        .object({
          welcomeEmail: z.boolean().optional(),
          assignSalesOnA: z.boolean().optional(),
          nurtureOnEnd: z.boolean().optional(),
        })
        .optional(),
    })
    .optional(),
  eventId: z.string().optional(),
});

export const PATCH = withErrorHandler(async (request) => {
  const { session } = await requireAuth([
    UserRole.PLATFORM_ADMIN,
    UserRole.ORGANIZER,
  ]);

  const body = await request.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return createErrorResponse("参数错误", ErrorCode.VALIDATION_ERROR, 400);
  }

  const existing = await getPlatformMarketupConfig();
  const nextConfig: MarketupSyncConfig = parsed.data.config
    ? parsePlatformSyncConfig({
        ...existing.config,
        ...parsed.data.config,
        triggers: {
          ...existing.config.triggers,
          ...parsed.data.config.triggers,
        },
      })
    : existing.config;

  if (session.user.role === UserRole.PLATFORM_ADMIN && !parsed.data.eventId) {
    await savePlatformMarketupConfig({
      fieldMap: parsed.data.fieldMap ?? existing.fieldMap,
      config: nextConfig,
    });
    return createSuccessResponse({ saved: true });
  }

  const eventId =
    parsed.data.eventId ??
    session.user.entityId ??
    (
      await prisma.event.findFirst({
        where: { organizerId: session.user.id },
        select: { id: true },
      })
    )?.id;

  if (!eventId) {
    return createErrorResponse("未找到关联活动", ErrorCode.VALIDATION_ERROR, 400);
  }

  const { upsertExternalSync } = await import("@/lib/external-sync");

  if (parsed.data.fieldMap) {
    await upsertExternalSync(eventId, { fieldMap: parsed.data.fieldMap });
  }

  if (parsed.data.config) {
    await upsertExternalSync(eventId, { syncConfig: nextConfig });
  }

  await prisma.eventSetting.upsert({
    where: { eventId_key: { eventId, key: "marketup_field_map" } },
    create: {
      eventId,
      key: "marketup_field_map",
      value: (parsed.data.fieldMap ?? existing.fieldMap) as Prisma.InputJsonValue,
    },
    update: {
      value: (parsed.data.fieldMap ?? existing.fieldMap) as Prisma.InputJsonValue,
    },
  });

  await prisma.eventSetting.upsert({
    where: { eventId_key: { eventId, key: "marketup_sync_config" } },
    create: {
      eventId,
      key: "marketup_sync_config",
      value: nextConfig as Prisma.InputJsonValue,
    },
    update: { value: nextConfig as Prisma.InputJsonValue },
  });

  return createSuccessResponse({ saved: true });
});
