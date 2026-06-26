import { prisma } from "@connectiq/database";

export type ApiIntentResponseRow = {
  id: string;
  user: {
    id: string;
    name: string;
    company: string | null;
    industry: string | null;
  };
  role: string | null;
  supply_tags: string[];
  demand_tags: string[];
  topics: string[];
  updated_at: string;
};

export type ApiIntentTagStat = {
  tag: string;
  count: number;
  pool: "supply" | "demand" | "topic";
};

export type ApiIntentResponsesStats = {
  submitted_count: number;
  eligible_count: number;
  fill_rate: number;
  with_supply: number;
  with_demand: number;
  with_role: number;
  with_topics: number;
  top_supply_tags: ApiIntentTagStat[];
  top_demand_tags: ApiIntentTagStat[];
  top_topics: ApiIntentTagStat[];
};

export type ApiIntentResponsesResult = {
  rows: ApiIntentResponseRow[];
  stats: ApiIntentResponsesStats;
};

function countTags(tags: string[], map: Map<string, number>) {
  for (const tag of tags) {
    const key = tag.trim();
    if (!key) continue;
    map.set(key, (map.get(key) ?? 0) + 1);
  }
}

function topTags(
  map: Map<string, number>,
  pool: ApiIntentTagStat["pool"],
  limit = 8,
): ApiIntentTagStat[] {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([tag, count]) => ({ tag, count, pool }));
}

export async function getEventIntentResponses(
  eventId: string,
): Promise<ApiIntentResponsesResult> {
  const [intents, participantCount] = await Promise.all([
    prisma.userEventIntent.findMany({
      where: { eventId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            profile: { select: { company: true, industry: true } },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.participant.count({ where: { eventId } }),
  ]);

  const supplyMap = new Map<string, number>();
  const demandMap = new Map<string, number>();
  const topicMap = new Map<string, number>();

  let withSupply = 0;
  let withDemand = 0;
  let withRole = 0;
  let withTopics = 0;

  for (const intent of intents) {
    if (intent.supplyTags.length > 0) withSupply++;
    if (intent.demandTags.length > 0) withDemand++;
    if (intent.role) withRole++;
    if (intent.topics.length > 0) withTopics++;
    countTags(intent.supplyTags, supplyMap);
    countTags(intent.demandTags, demandMap);
    countTags(intent.topics, topicMap);
  }

  const submittedCount = intents.length;
  const eligibleCount = Math.max(participantCount, submittedCount);
  const fillRate =
    eligibleCount > 0 ? Math.round((submittedCount / eligibleCount) * 100) : 0;

  const rows: ApiIntentResponseRow[] = intents.map((intent) => ({
    id: intent.id,
    user: {
      id: intent.user.id,
      name: intent.user.name,
      company: intent.user.profile?.company ?? null,
      industry: intent.user.profile?.industry ?? null,
    },
    role: intent.role,
    supply_tags: intent.supplyTags,
    topics: intent.topics,
    demand_tags: intent.demandTags,
    updated_at: intent.updatedAt.toISOString(),
  }));

  return {
    rows,
    stats: {
      submitted_count: submittedCount,
      eligible_count: eligibleCount,
      fill_rate: fillRate,
      with_supply: withSupply,
      with_demand: withDemand,
      with_role: withRole,
      with_topics: withTopics,
      top_supply_tags: topTags(supplyMap, "supply"),
      top_demand_tags: topTags(demandMap, "demand"),
      top_topics: topTags(topicMap, "topic"),
    },
  };
}
