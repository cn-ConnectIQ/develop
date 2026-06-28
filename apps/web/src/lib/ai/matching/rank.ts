import { prisma } from "@connectiq/database";
import { formatMatchReasons, type MatchReasonItem } from "@/lib/matchmaking-config";
import {
  DEFAULT_RANK_TOP_N,
  mergeLlmComplementConfig,
  mergeMatchingWeights,
  type MatchingWeights,
  type RankOptions,
} from "./config";
import { getEffectiveMatchingWeights } from "./match-feedback-analysis";
import { recallCandidates, type RecallOptions } from "./recall";
import {
  applyLlmComplementRanking,
  selectBorderlineCandidates,
  type ScoredCandidateRow,
} from "./rank-llm-complement";
import { applyBehaviorSignalRanking } from "./rank-signals";
import type { MatchDimension, RankedCandidate, RecallCandidate } from "./types";

const DIMENSION_WEIGHT_KEY: Record<
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

const DIMENSION_REASON_TYPE: Record<
  MatchDimension,
  MatchReasonItem["type"]
> = {
  demand_supply: "demand_supply",
  supply_demand: "supply_demand",
  role_complement: "shared_role",
  shared_topic: "shared_topic",
  shared_industry: "industry",
  co_presence: "signal",
  interaction: "signal",
  semantic_similarity: "semantic",
};

function scoreCandidate(
  candidate: RecallCandidate,
  weights: MatchingWeights,
): { score: number; matchReasons: MatchReasonItem[] } {
  const dimensionCounts = new Map<MatchDimension, number>();
  const matchReasons: MatchReasonItem[] = [];

  for (const hit of candidate.dimensions) {
    dimensionCounts.set(
      hit.dimension,
      (dimensionCounts.get(hit.dimension) ?? 0) + 1,
    );
    matchReasons.push({
      type: DIMENSION_REASON_TYPE[hit.dimension],
      label: hit.label,
      detail: hit.detail,
    });
  }

  let score = 0;

  for (const [dimension, count] of dimensionCounts) {
    const weightKey = DIMENSION_WEIGHT_KEY[dimension];
    if (!weightKey) continue;
    score += weights[weightKey] * count;
  }

  score = Math.min(100, Math.round(score));

  return { score, matchReasons };
}

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}

async function loadViewerIntentTags(
  userId: string,
  eventId: string,
): Promise<{ supplyTags: string[]; demandTags: string[] }> {
  const intent = await prisma.userEventIntent.findUnique({
    where: { userId_eventId: { userId, eventId } },
    select: { supplyTags: true, demandTags: true },
  });
  return {
    supplyTags: intent?.supplyTags ?? [],
    demandTags: intent?.demandTags ?? [],
  };
}

/**
 * 对召回候选加权打分并排序，返回 Top N。
 * 传入 eventId 时启用行为信号精排；LLM 语义互补仅对边界候选（可选）。
 */
export async function rankCandidates(
  userId: string,
  candidates: RecallCandidate[],
  options?: RankOptions,
): Promise<RankedCandidate[]> {
  const topN = options?.topN ?? DEFAULT_RANK_TOP_N;
  const eventId = options?.eventId;
  const weights: MatchingWeights = eventId
    ? await getEffectiveMatchingWeights(eventId, options?.weights)
    : mergeMatchingWeights(options?.weights);
  const enableLlm = options?.enableLlmComplement !== false;
  const llmConfig = mergeLlmComplementConfig(options?.llmComplement);

  const baseRows = candidates.map((candidate) => {
    const { score, matchReasons } = scoreCandidate(candidate, weights);
    return { candidate, baseScore: score, matchReasons };
  });

  let signalAdjustments = new Map<
    string,
    { delta: number; reasons: MatchReasonItem[] }
  >();

  if (eventId && candidates.length > 0) {
    const { supplyTags, demandTags } = await loadViewerIntentTags(
      userId,
      eventId,
    );
    signalAdjustments = await applyBehaviorSignalRanking(
      userId,
      eventId,
      candidates,
      demandTags,
      supplyTags,
      options?.signalWeights,
    );
  }

  const scoredRows: ScoredCandidateRow[] = baseRows.map((row) => {
    const signal = signalAdjustments.get(row.candidate.userId);
    const adjustedScore = clampScore(row.baseScore + (signal?.delta ?? 0));
    return {
      candidate: row.candidate,
      baseScore: row.baseScore,
      adjustedScore,
    };
  });

  let llmAdjustments = new Map<string, { delta: number; reason: string }>();

  if (eventId && enableLlm && candidates.length > 0) {
    try {
      const borderline = selectBorderlineCandidates(
        scoredRows,
        topN,
        llmConfig,
      );
      llmAdjustments = await applyLlmComplementRanking(
        userId,
        eventId,
        borderline,
        llmConfig,
      );

      for (const row of scoredRows) {
        const llm = llmAdjustments.get(row.candidate.userId);
        if (llm) {
          row.adjustedScore = clampScore(row.adjustedScore + llm.delta);
        }
      }
    } catch (error) {
      console.warn("[rank] llm complement skipped:", error);
    }
  }

  const ranked: RankedCandidate[] = baseRows.map((row) => {
    const signal = signalAdjustments.get(row.candidate.userId);
    const llm = llmAdjustments.get(row.candidate.userId);
    const matchReasons = [...row.matchReasons];

    if (signal?.reasons.length) {
      matchReasons.push(...signal.reasons);
    }
    if (llm?.reason) {
      matchReasons.push({
        type: "semantic",
        label: llm.reason,
      });
    }

    const scored = scoredRows.find(
      (s) => s.candidate.userId === row.candidate.userId,
    );

    return {
      ...row.candidate,
      score: scored?.adjustedScore ?? row.baseScore,
      matchReasons,
    };
  });

  ranked.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.recallScore - a.recallScore;
  });

  return ranked.slice(0, topN);
}

/** 将 RankedCandidate 转为展示用 reason 字符串 */
export function formatRankedReason(candidate: RankedCandidate): string {
  return formatMatchReasons(candidate.matchReasons);
}

/** 召回 + 打分一站式（现场实时入口） */
export async function recallAndRank(
  userId: string,
  eventId: string,
  options?: RankOptions & { recallLimits?: RecallOptions["limits"] },
) {
  const candidates = await recallCandidates(userId, eventId, {
    limits: options?.recallLimits,
  });
  const ranked = await rankCandidates(userId, candidates, {
    ...options,
    eventId,
  });
  return { candidates, ranked };
}
