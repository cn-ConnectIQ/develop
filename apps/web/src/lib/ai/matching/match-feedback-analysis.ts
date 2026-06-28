import { MatchFeedbackSignal, prisma } from "@connectiq/database";
import {
  DEFAULT_MATCHING_WEIGHTS,
  mergeMatchingWeights,
  type MatchingWeights,
} from "@/lib/ai/matching/config";
import { FEEDBACK_SIGNAL_OUTCOME_SCORE } from "@/lib/ai/matching/match-feedback-service";
import type { MatchDimension, MatchDimensionHit } from "@/lib/ai/matching/types";

const DIMENSION_TO_WEIGHT_KEY: Record<
  MatchDimension,
  keyof MatchingWeights | null
> = {
  demand_supply: "demandSupplyMatch",
  supply_demand: "supplyDemandMatch",
  role_complement: "roleComplement",
  shared_topic: "sharedTopic",
  shared_industry: "sharedIndustry",
  co_presence: "coPresence",
  interaction: "interactionSignal",
  semantic_similarity: "semanticSimilarity",
};

const MIN_SAMPLES_FOR_TUNING = 20;
const WEIGHT_DELTA_CAP = 8;
const BASELINE_ADOPTION = 0.28;

function parseDimensions(raw: unknown): MatchDimensionHit[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (item): item is MatchDimensionHit =>
      !!item &&
      typeof item === "object" &&
      typeof (item as MatchDimensionHit).dimension === "string",
  );
}

function outcomeScore(signal: MatchFeedbackSignal): number {
  return FEEDBACK_SIGNAL_OUTCOME_SCORE[signal] ?? 0;
}

export type DimensionAdoptionStat = {
  dimension: MatchDimension;
  weightKey: keyof MatchingWeights;
  sampleCount: number;
  avgOutcome: number;
  adoptionRate: number;
};

export type FeedbackWeightAnalysis = {
  eventId: string | null;
  sampleSize: number;
  dimensionStats: DimensionAdoptionStat[];
  suggestedWeights: Partial<MatchingWeights>;
};

/**
 * 统计各匹配维度在反馈中的采纳率（离线分析，非实时）。
 */
export async function analyzeMatchFeedbackWeights(
  eventId?: string,
  options?: { sinceDays?: number; minSamples?: number },
): Promise<FeedbackWeightAnalysis> {
  const sinceDays = options?.sinceDays ?? 90;
  const minSamples = options?.minSamples ?? MIN_SAMPLES_FOR_TUNING;
  const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000);

  const rows = await prisma.matchFeedback.findMany({
    where: {
      ...(eventId ? { eventId } : {}),
      createdAt: { gte: since },
    },
    select: {
      signal: true,
      matchDimensions: true,
    },
  });

  const dimensionBuckets = new Map<
    MatchDimension,
    { outcomes: number[]; positive: number }
  >();

  for (const row of rows) {
    const score = outcomeScore(row.signal);
    const isPositive = score > 0;
    const dims = parseDimensions(row.matchDimensions);

    for (const hit of dims) {
      const bucket = dimensionBuckets.get(hit.dimension) ?? {
        outcomes: [],
        positive: 0,
      };
      bucket.outcomes.push(score);
      if (isPositive) bucket.positive++;
      dimensionBuckets.set(hit.dimension, bucket);
    }
  }

  const dimensionStats: DimensionAdoptionStat[] = [];
  const suggestedWeights: Partial<MatchingWeights> = {};

  for (const [dimension, bucket] of dimensionBuckets) {
    const weightKey = DIMENSION_TO_WEIGHT_KEY[dimension];
    if (!weightKey) continue;
    if (bucket.outcomes.length < 5) continue;

    const adoptionRate = bucket.positive / bucket.outcomes.length;
    const avgOutcome =
      bucket.outcomes.reduce((a, b) => a + b, 0) / bucket.outcomes.length;

    dimensionStats.push({
      dimension,
      weightKey,
      sampleCount: bucket.outcomes.length,
      avgOutcome: Math.round(avgOutcome * 100) / 100,
      adoptionRate: Math.round(adoptionRate * 100) / 100,
    });

    if (rows.length < minSamples) continue;

    const defaultWeight = DEFAULT_MATCHING_WEIGHTS[weightKey];
    const delta = (adoptionRate - BASELINE_ADOPTION) * 40;
    const clampedDelta = Math.max(
      -WEIGHT_DELTA_CAP,
      Math.min(WEIGHT_DELTA_CAP, Math.round(delta)),
    );
    suggestedWeights[weightKey] = Math.max(
      2,
      defaultWeight + clampedDelta,
    );
  }

  dimensionStats.sort((a, b) => b.adoptionRate - a.adoptionRate);

  return {
    eventId: eventId ?? null,
    sampleSize: rows.length,
    dimensionStats,
    suggestedWeights,
  };
}

/**
 * 离线跑批：分析反馈并持久化权重覆盖（cron 调用，不必实时）。
 */
export async function runOfflineMatchWeightTuning(
  eventId: string,
): Promise<FeedbackWeightAnalysis | null> {
  const analysis = await analyzeMatchFeedbackWeights(eventId);
  if (analysis.sampleSize < MIN_SAMPLES_FOR_TUNING) {
    return analysis;
  }
  if (Object.keys(analysis.suggestedWeights).length === 0) {
    return analysis;
  }

  await prisma.matchWeightTuning.upsert({
    where: { eventId },
    create: {
      eventId,
      weights: analysis.suggestedWeights,
      sampleSize: analysis.sampleSize,
    },
    update: {
      weights: analysis.suggestedWeights,
      sampleSize: analysis.sampleSize,
      computedAt: new Date(),
    },
  });

  return analysis;
}

/** 读取已持久化的反馈调权（rank 精排时合并） */
export async function loadFeedbackTunedWeights(
  eventId?: string,
): Promise<Partial<MatchingWeights>> {
  if (!eventId) return {};

  const tuning = await prisma.matchWeightTuning.findUnique({
    where: { eventId },
    select: { weights: true, sampleSize: true },
  });

  if (!tuning || tuning.sampleSize < MIN_SAMPLES_FOR_TUNING) {
    return {};
  }

  if (!tuning.weights || typeof tuning.weights !== "object") {
    return {};
  }

  return tuning.weights as Partial<MatchingWeights>;
}

export async function getEffectiveMatchingWeights(
  eventId?: string,
  overrides?: Partial<MatchingWeights>,
): Promise<MatchingWeights> {
  const feedbackTuning = await loadFeedbackTunedWeights(eventId);
  return mergeMatchingWeights({
    ...feedbackTuning,
    ...overrides,
  });
}
