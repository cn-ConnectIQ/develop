import { prisma } from "@connectiq/database";

import {
  parseEventFeatureFlags,
  type EventFeatureFlagKey,
  type EventFeatureFlags,
} from "@/lib/event-feature-flags";

export async function loadEventFeatureFlags(
  eventId: string,
): Promise<EventFeatureFlags> {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { featureFlags: true },
  });
  return parseEventFeatureFlags(event?.featureFlags ?? null);
}

export async function isEventFeatureEnabled(
  eventId: string,
  key: EventFeatureFlagKey,
): Promise<boolean> {
  const flags = await loadEventFeatureFlags(eventId);
  return flags[key];
}
