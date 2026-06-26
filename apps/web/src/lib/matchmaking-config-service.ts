import { prisma } from "@connectiq/database";
import {
  DEFAULT_INTENT_CONFIG,
  type EventIntentConfig,
  parseIntentConfig,
} from "@/lib/matchmaking-config";

export type ApiMatchmakingConfig = {
  intent_config: EventIntentConfig;
  premeet_enabled: boolean;
  premeet_open_at: string | null;
  premeet_open_at_computed: string | null;
  event_start_date: string | null;
};

function computePremeetOpenAt(
  startDate: Date | null,
  daysBefore: number,
  explicitOpenAt: Date | null,
): string | null {
  if (explicitOpenAt) return explicitOpenAt.toISOString();
  if (!startDate || daysBefore <= 0) return null;
  const open = new Date(startDate);
  open.setDate(open.getDate() - daysBefore);
  return open.toISOString();
}

export async function getMatchmakingConfig(
  eventId: string,
): Promise<ApiMatchmakingConfig> {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      intentConfig: true,
      premeetEnabled: true,
      premeetOpenAt: true,
      startDate: true,
    },
  });
  if (!event) throw new Error("活动不存在");

  const intentConfig = parseIntentConfig(event.intentConfig);

  return {
    intent_config: intentConfig,
    premeet_enabled: event.premeetEnabled,
    premeet_open_at: event.premeetOpenAt?.toISOString() ?? null,
    premeet_open_at_computed: computePremeetOpenAt(
      event.startDate,
      intentConfig.premeet_days_before,
      event.premeetOpenAt,
    ),
    event_start_date: event.startDate?.toISOString() ?? null,
  };
}

export async function updateMatchmakingConfig(
  eventId: string,
  data: {
    intent_config?: Partial<EventIntentConfig> & {
      supply?: Partial<EventIntentConfig["supply"]>;
      demand?: Partial<EventIntentConfig["demand"]>;
      role?: Partial<EventIntentConfig["role"]>;
      topics?: Partial<EventIntentConfig["topics"]>;
    };
    premeet_enabled?: boolean;
    premeet_open_at?: string | null;
    premeet_days_before?: number;
  },
): Promise<ApiMatchmakingConfig> {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      intentConfig: true,
      premeetOpenAt: true,
      startDate: true,
    },
  });
  if (!event) throw new Error("活动不存在");

  const current = parseIntentConfig(event.intentConfig);
  let nextConfig = current;

  if (data.intent_config) {
    const patch = data.intent_config;
    nextConfig = {
      ...current,
      ...patch,
      supply: { ...current.supply, ...patch.supply },
      demand: { ...current.demand, ...patch.demand },
      role: { ...current.role, ...patch.role },
      topics: { ...current.topics, ...patch.topics },
    };
  }

  if (data.premeet_days_before !== undefined) {
    nextConfig = { ...nextConfig, premeet_days_before: data.premeet_days_before };
  }

  const eventUpdate: {
    intentConfig: EventIntentConfig;
    premeetEnabled?: boolean;
    premeetOpenAt?: Date | null;
  } = {
    intentConfig: nextConfig,
  };

  if (data.premeet_enabled !== undefined) {
    eventUpdate.premeetEnabled = data.premeet_enabled;
  }

  if (data.premeet_open_at !== undefined) {
    eventUpdate.premeetOpenAt = data.premeet_open_at
      ? new Date(data.premeet_open_at)
      : null;
  } else if (
    data.premeet_days_before !== undefined &&
    event.startDate &&
    !event.premeetOpenAt
  ) {
    const open = new Date(event.startDate);
    open.setDate(open.getDate() - data.premeet_days_before);
    eventUpdate.premeetOpenAt = open;
  }

  await prisma.event.update({
    where: { id: eventId },
    data: eventUpdate,
  });

  return getMatchmakingConfig(eventId);
}

export { DEFAULT_INTENT_CONFIG };
