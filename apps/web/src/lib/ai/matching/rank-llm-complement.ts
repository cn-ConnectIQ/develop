import { prisma } from "@connectiq/database";
import { callLLM, isLLMConfigured } from "@/lib/ai/llm";
import {
  buildComplementCheckPrompt,
  COMPLEMENT_CHECK_SYSTEM,
  sanitizeComplementResults,
  type ComplementCheckLLMResult,
} from "@/lib/ai/prompts/complement-check";
import {
  DEFAULT_LLM_COMPLEMENT_CONFIG,
  type LlmComplementConfig,
} from "./config";
import type { RecallCandidate } from "./types";

export type ScoredCandidateRow = {
  candidate: RecallCandidate;
  baseScore: number;
  adjustedScore: number;
};

export type LlmComplementAdjustment = {
  delta: number;
  reason: string;
};

function hasStrongRuleMatch(candidate: RecallCandidate): boolean {
  return candidate.dimensions.some((d) =>
    ["demand_supply", "supply_demand"].includes(d.dimension),
  );
}

/** 选出规则分接近、需 LLM 二次判断的边界候选（控成本） */
export function selectBorderlineCandidates(
  rows: ScoredCandidateRow[],
  topN: number,
  config: LlmComplementConfig = DEFAULT_LLM_COMPLEMENT_CONFIG,
): RecallCandidate[] {
  if (rows.length === 0) return [];

  const sorted = [...rows].sort((a, b) => b.adjustedScore - a.adjustedScore);
  const cutoffIdx = Math.min(Math.max(topN - 1, 0), sorted.length - 1);
  const cutoffScore = sorted[cutoffIdx]!.adjustedScore;

  const selected: RecallCandidate[] = [];
  const picked = new Set<string>();

  for (let i = 0; i < sorted.length; i++) {
    if (selected.length >= config.maxChecks) break;

    const row = sorted[i]!;
    const nearCutoff =
      Math.abs(row.adjustedScore - cutoffScore) <= config.scoreBand;
    const inMarginZone =
      i >= Math.max(0, topN - config.marginBefore) &&
      i <= topN + config.marginAfter - 1;

    if (!nearCutoff && !inMarginZone) continue;
    if (hasStrongRuleMatch(row.candidate)) continue;
    if (picked.has(row.candidate.userId)) continue;

    const hasTags =
      row.candidate.supplyTags.length > 0 ||
      row.candidate.demandTags.length > 0;
    if (!hasTags) continue;

    selected.push(row.candidate);
    picked.add(row.candidate.userId);
  }

  return selected;
}

export async function applyLlmComplementRanking(
  viewerId: string,
  eventId: string,
  borderline: RecallCandidate[],
  config: LlmComplementConfig = DEFAULT_LLM_COMPLEMENT_CONFIG,
): Promise<Map<string, LlmComplementAdjustment>> {
  const result = new Map<string, LlmComplementAdjustment>();
  if (borderline.length === 0) return result;
  if (!isLLMConfigured()) return result;

  const [viewerUser, viewerIntent] = await Promise.all([
    prisma.user.findUnique({
      where: { id: viewerId },
      select: { name: true },
    }),
    prisma.userEventIntent.findUnique({
      where: { userId_eventId: { userId: viewerId, eventId } },
      select: {
        role: true,
        supplyTags: true,
        demandTags: true,
        topics: true,
        rawIntentText: true,
      },
    }),
  ]);

  if (!viewerIntent) return result;

  const allowedIds = new Set(borderline.map((c) => c.userId));

  try {
    const llmResult = await callLLM<{ results: unknown }>({
      system: COMPLEMENT_CHECK_SYSTEM,
      prompt: buildComplementCheckPrompt(
        {
          name: viewerUser?.name,
          role: viewerIntent.role,
          supply_tags: viewerIntent.supplyTags,
          demand_tags: viewerIntent.demandTags,
          topics: viewerIntent.topics,
          raw_intent_text: viewerIntent.rawIntentText,
        },
        borderline.map((c) => ({
          candidate_id: c.userId,
          name: c.name,
          role: c.role,
          supply_tags: c.supplyTags,
          demand_tags: c.demandTags,
          topics: c.topics,
        })),
      ),
      jsonMode: true,
      maxTokens: 512,
      temperature: 0.1,
    });

    const parsed: ComplementCheckLLMResult[] = sanitizeComplementResults(
      llmResult.parsed,
      allowedIds,
    );

    for (const row of parsed) {
      if (row.boost <= 0) continue;
      result.set(row.candidate_id, {
        delta: Math.min(row.boost, config.maxBoost),
        reason: row.reason || "供需实质互补",
      });
    }
  } catch {
    // LLM 失败时静默降级
  }

  return result;
}
