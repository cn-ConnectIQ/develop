import { IntentTagPool, prisma } from "@connectiq/database";
import {
  DEFAULT_INTENT_CONFIG,
  parseIntentConfig,
} from "@/lib/matchmaking-config";
import { slugifyIntentTagLabel } from "@/lib/intent-tag-service";

export const DEFAULT_ROLE_TAG_OPTIONS = [
  "采购方",
  "供应方",
  "投资方",
  "被投方",
  "合作方",
] as const;

export type IntentTagLibrary = {
  tags: Awaited<ReturnType<typeof listRawEventIntentTags>>;
  supply: string[];
  demand: string[];
  roles: string[];
  topics: string[];
};

async function listRawEventIntentTags(eventId: string) {
  return prisma.intentTag.findMany({
    where: { eventId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
}

function labelsForPool(
  tags: Awaited<ReturnType<typeof listRawEventIntentTags>>,
  pool: IntentTagPool,
): string[] {
  return tags.filter((t) => t.pool === pool).map((t) => t.label);
}

export function normalizeIntentTagLabels(raw: string[] | undefined | null): string[] {
  if (!raw?.length) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of raw) {
    const label = item.trim();
    if (!label) continue;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(label);
  }
  return result;
}

export async function getEventIntentTagLibrary(
  eventId: string,
): Promise<IntentTagLibrary> {
  const [tags, event] = await Promise.all([
    listRawEventIntentTags(eventId),
    prisma.event.findUnique({
      where: { id: eventId },
      select: { intentConfig: true },
    }),
  ]);

  const config = parseIntentConfig(event?.intentConfig);
  const roles =
    config.role.options.length > 0
      ? config.role.options
      : [...DEFAULT_ROLE_TAG_OPTIONS];

  return {
    tags,
    supply: labelsForPool(tags, IntentTagPool.SUPPLY),
    demand: labelsForPool(tags, IntentTagPool.DEMAND),
    topics: labelsForPool(tags, IntentTagPool.TOPIC),
    roles,
  };
}

async function syncPoolLabels(
  eventId: string,
  pool: IntentTagPool,
  labels: string[],
) {
  const normalized = normalizeIntentTagLabels(labels);
  const existing = await prisma.intentTag.findMany({
    where: { eventId, pool },
  });

  const existingByLabel = new Map(
    existing.map((tag) => [tag.label.toLowerCase(), tag]),
  );
  const nextSlugs = new Set<string>();

  for (const [index, label] of normalized.entries()) {
    const found = existingByLabel.get(label.toLowerCase());
    if (found) {
      nextSlugs.add(found.slug);
      if (found.sortOrder !== index || found.label !== label) {
        await prisma.intentTag.update({
          where: { id: found.id },
          data: { sortOrder: index, label },
        });
      }
      continue;
    }

    let slug = slugifyIntentTagLabel(label);
    let suffix = 1;
    while (
      nextSlugs.has(slug) ||
      (await prisma.intentTag.findFirst({
        where: { eventId, slug },
        select: { id: true },
      }))
    ) {
      slug = `${slugifyIntentTagLabel(label)}-${suffix++}`;
    }
    nextSlugs.add(slug);

    await prisma.intentTag.create({
      data: {
        eventId,
        label,
        slug,
        pool,
        sortOrder: index,
      },
    });
  }

  const keepLabels = new Set(normalized.map((l) => l.toLowerCase()));
  const deleteIds = existing
    .filter((tag) => !keepLabels.has(tag.label.toLowerCase()))
    .map((tag) => tag.id);

  if (deleteIds.length > 0) {
    await prisma.intentTag.deleteMany({
      where: { id: { in: deleteIds } },
    });
  }
}

export async function saveEventIntentTagLibrary(
  eventId: string,
  input: {
    supply: string[];
    demand: string[];
    roles: string[];
    topics: string[];
  },
): Promise<IntentTagLibrary> {
  const supply = normalizeIntentTagLabels(input.supply);
  const demand = normalizeIntentTagLabels(input.demand);
  const topics = normalizeIntentTagLabels(input.topics);
  const roles = normalizeIntentTagLabels(input.roles);

  await syncPoolLabels(eventId, IntentTagPool.SUPPLY, supply);
  await syncPoolLabels(eventId, IntentTagPool.DEMAND, demand);
  await syncPoolLabels(eventId, IntentTagPool.TOPIC, topics);

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { intentConfig: true },
  });
  const current = parseIntentConfig(event?.intentConfig);

  await prisma.event.update({
    where: { id: eventId },
    data: {
      intentConfig: {
        ...current,
        role: {
          ...current.role,
          enabled: current.role.enabled,
          allow_custom: current.role.allow_custom,
          options: roles.length > 0 ? roles : [...DEFAULT_ROLE_TAG_OPTIONS],
        },
        supply: { ...current.supply, enabled: true, allow_custom: true },
        demand: { ...current.demand, enabled: true, allow_custom: true },
        topics: { ...current.topics, enabled: true, allow_custom: true },
      },
    },
  });

  return getEventIntentTagLibrary(eventId);
}

export { DEFAULT_INTENT_CONFIG };
