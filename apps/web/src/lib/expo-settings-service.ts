import { prisma } from "@connectiq/database";

const EXPO_KEYS = [
  "expo_registration",
  "expo_buyer",
  "expo_matching",
  "expo_notifications",
] as const;

export type ExpoSettingKey = (typeof EXPO_KEYS)[number];

export type ExpoSettingsStaff = Array<{
  id: string;
  role: string;
  user: { id: string; name: string; phone: string | null };
}>;

export type ExpoSettingsPayload = {
  settings: Record<string, Record<string, unknown>>;
  staff: ExpoSettingsStaff;
};

export async function getExpoSettings(eventId: string) {
  const rows = await prisma.eventSetting.findMany({
    where: {
      eventId,
      key: { in: [...EXPO_KEYS] },
    },
  });
  const map: Record<string, Record<string, unknown>> = {};
  for (const row of rows) {
    if (row.value && typeof row.value === "object" && !Array.isArray(row.value)) {
      map[row.key] = row.value as Record<string, unknown>;
    }
  }
  return map;
}

export async function loadExpoSettingsPayload(
  eventId: string,
): Promise<ExpoSettingsPayload> {
  const [settings, event] = await Promise.all([
    getExpoSettings(eventId),
    prisma.event.findUnique({
      where: { id: eventId },
      select: {
        org: {
          select: {
            staff: {
              include: {
                user: { select: { id: true, name: true, phone: true } },
              },
            },
          },
        },
      },
    }),
  ]);

  return {
    settings,
    staff: event?.org?.staff ?? [],
  };
}
