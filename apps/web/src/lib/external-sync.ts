import { prisma, type Prisma } from "@connectiq/database";
import type { MarketupSyncConfig } from "@/types/booth";
import { DEFAULT_MARKETUP_SYNC_CONFIG } from "@/lib/form-config";

const PROVIDER = "marketup";

export async function getExternalSync(eventId: string) {
  let sync = await prisma.externalSync.findUnique({
    where: { eventId_provider: { eventId, provider: PROVIDER } },
  });

  if (!sync) {
    const [legacyMap, legacyConfig] = await Promise.all([
      prisma.eventSetting.findUnique({
        where: { eventId_key: { eventId, key: "marketup_field_map" } },
      }),
      prisma.eventSetting.findUnique({
        where: { eventId_key: { eventId, key: "marketup_sync_config" } },
      }),
    ]);

    const fieldMap =
      legacyMap?.value && typeof legacyMap.value === "object"
        ? legacyMap.value
        : {};
    const syncConfig =
      legacyConfig?.value && typeof legacyConfig.value === "object"
        ? legacyConfig.value
        : DEFAULT_MARKETUP_SYNC_CONFIG;

    sync = await prisma.externalSync.create({
      data: {
        eventId,
        provider: PROVIDER,
        fieldMap: fieldMap as Prisma.InputJsonValue,
        syncConfig: syncConfig as Prisma.InputJsonValue,
      },
    });
  }

  return sync;
}

export async function upsertExternalSync(
  eventId: string,
  data: {
    fieldMap?: Record<string, string>;
    syncConfig?: MarketupSyncConfig;
  },
) {
  const existing = await getExternalSync(eventId);

  return prisma.externalSync.update({
    where: { id: existing.id },
    data: {
      ...(data.fieldMap !== undefined && {
        fieldMap: data.fieldMap as Prisma.InputJsonValue,
      }),
      ...(data.syncConfig !== undefined && {
        syncConfig: data.syncConfig as Prisma.InputJsonValue,
      }),
    },
  });
}

export function parseFieldMap(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const result: Record<string, string> = {};
  for (const [key, val] of Object.entries(value)) {
    if (typeof val === "string") result[key] = val;
  }
  return result;
}

export function parseSyncConfig(value: unknown): MarketupSyncConfig {
  if (!value || typeof value !== "object") return DEFAULT_MARKETUP_SYNC_CONFIG;
  const obj = value as MarketupSyncConfig;
  return {
    writeStrategy: obj.writeStrategy ?? "upsert",
    conflictPolicy: obj.conflictPolicy ?? "connectiq",
    triggers: {
      welcomeEmail: obj.triggers?.welcomeEmail ?? false,
      assignSalesOnA: obj.triggers?.assignSalesOnA ?? true,
      nurtureOnEnd: obj.triggers?.nurtureOnEnd ?? true,
    },
  };
}
