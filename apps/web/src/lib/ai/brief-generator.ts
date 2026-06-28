import { AiGenerationType, prisma } from "@connectiq/database";
import { callLLM, isLLMConfigured, LlmError } from "@/lib/ai/llm";
import {
  buildMatchBriefPrompt,
  MATCH_BRIEF_SYSTEM,
  type MatchBriefDimension,
  type MatchBriefLLMResult,
  type MatchBriefProfile,
} from "@/lib/ai/prompts/match-brief";
import type { MatchDimensionHit } from "@/lib/ai/matching/types";

const PROMPT_VERSION = "match-brief-v1";

export type GenerateBriefInput = {
  viewerProfile: MatchBriefProfile;
  targetProfile: MatchBriefProfile;
  matchDimensions: MatchDimensionHit[];
  matchScore: number;
  eventName?: string;
};

export type GenerateBriefResult = {
  brief: string;
  match_reason: string;
  source: "llm" | "fallback";
};

function dimensionsToBriefInput(
  dimensions: MatchDimensionHit[],
): MatchBriefDimension[] {
  return dimensions.map((d) => ({
    dimension: d.dimension,
    label: d.label,
    detail: d.detail,
  }));
}

function buildFallbackBrief(input: GenerateBriefInput): GenerateBriefResult {
  const role = [input.targetProfile.company, input.targetProfile.title]
    .filter(Boolean)
    .join(" · ");
  const sharedHint = input.matchDimensions[0]?.label;

  const brief = [
    `${input.targetProfile.name}${role ? `（${role}）` : ""}`,
    sharedHint
      ? `：${sharedHint}，可作为开场话题聊聊合作可能。`
      : "：同场参会，建议先了解对方关注点后发起连接。",
  ].join("");

  const match_reason =
    sharedHint?.slice(0, 30) ??
    (input.matchScore >= 60
      ? "双方意向标签存在互补空间"
      : "同场参会，值得认识");

  return {
    brief,
    match_reason,
    source: "fallback",
  };
}

async function logBriefGeneration(
  preview: string,
  tokensUsed: number,
  adopted: boolean,
) {
  try {
    await prisma.aiGenerationLog.create({
      data: {
        type: AiGenerationType.SCAN_BRIEF,
        promptVersion: PROMPT_VERSION,
        tokensUsed,
        adopted,
        contentPreview: preview.slice(0, 200),
      },
    });
  } catch {
    // 日志失败不影响主流程
  }
}

/**
 * 用大模型生成见面简报 + 一句话匹配原因。
 * LLM 未配置或失败时降级为规则模板文案。
 */
export async function generateBrief(
  input: GenerateBriefInput,
): Promise<GenerateBriefResult> {
  if (!isLLMConfigured()) {
    return buildFallbackBrief(input);
  }

  try {
    const result = await callLLM<MatchBriefLLMResult>({
      system: MATCH_BRIEF_SYSTEM,
      prompt: buildMatchBriefPrompt({
        viewer: input.viewerProfile,
        target: input.targetProfile,
        matchDimensions: dimensionsToBriefInput(input.matchDimensions),
        matchScore: input.matchScore,
        eventName: input.eventName,
      }),
      jsonMode: true,
      maxTokens: 320,
      temperature: 0.2,
    });

    const parsed = result.parsed;
    const brief = parsed?.brief?.trim();
    const match_reason = parsed?.match_reason?.trim();

    if (!brief || !match_reason) {
      const fallback = buildFallbackBrief(input);
      void logBriefGeneration(brief ?? "", result.usage?.totalTokens ?? 0, false);
      return fallback;
    }

    void logBriefGeneration(brief, result.usage?.totalTokens ?? 0, true);

    return {
      brief: brief.slice(0, 500),
      match_reason: match_reason.slice(0, 80),
      source: "llm",
    };
  } catch (err) {
    if (err instanceof LlmError) {
      return buildFallbackBrief(input);
    }
    throw err;
  }
}
