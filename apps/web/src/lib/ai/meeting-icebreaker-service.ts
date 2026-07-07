import { callLLMText, isLLMConfigured, LlmError } from "@/lib/ai/llm";

export type IcebreakerProfile = {
  name: string;
  company?: string;
  title?: string;
  headline?: string;
  role?: string;
  supplyTags?: string[];
  demandTags?: string[];
  valueProposition?: string;
  aiBrief?: string;
  matchReason?: string;
};

const ICEBREAKER_SYSTEM = `你是B2B活动的会面助手,帮用户写一句简短的会面邀请开场白。
只基于提供的资料,不要编造。控制在50字以内,自然口语化。`;

const MAX_SUGGESTION_CHARS = 50;

function readString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function readStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const items = value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
  return items.length > 0 ? items : undefined;
}

/** 兼容 camelCase / snake_case 入参 */
export function normalizeIcebreakerProfile(
  raw: Record<string, unknown>,
): IcebreakerProfile | null {
  const name = readString(raw.name);
  if (!name) return null;

  return {
    name,
    company: readString(raw.company),
    title: readString(raw.title),
    headline: readString(raw.headline),
    role: readString(raw.role),
    supplyTags:
      readStringArray(raw.supplyTags) ?? readStringArray(raw.supply_tags),
    demandTags:
      readStringArray(raw.demandTags) ?? readStringArray(raw.demand_tags),
    valueProposition:
      readString(raw.valueProposition) ?? readString(raw.value_proposition),
    aiBrief: readString(raw.aiBrief) ?? readString(raw.ai_brief),
    matchReason:
      readString(raw.matchReason) ?? readString(raw.match_reason),
  };
}

function formatProfile(label: string, profile: IcebreakerProfile): string {
  const lines = [`【${label}】`, `姓名：${profile.name}`];

  const roleLine = [profile.company, profile.title].filter(Boolean).join(" · ");
  if (roleLine) lines.push(`身份：${roleLine}`);
  if (profile.role) lines.push(`角色：${profile.role}`);
  if (profile.headline) lines.push(`简介：${profile.headline}`);
  if (profile.valueProposition) {
    lines.push(`价值主张：${profile.valueProposition}`);
  }

  const intentParts = [
    profile.supplyTags?.length
      ? `提供：${profile.supplyTags.join("、")}`
      : null,
    profile.demandTags?.length
      ? `寻找：${profile.demandTags.join("、")}`
      : null,
  ].filter(Boolean);
  if (intentParts.length > 0) {
    lines.push(`意向：${intentParts.join("；")}`);
  }

  if (profile.aiBrief) lines.push(`匹配简报：${profile.aiBrief}`);
  if (profile.matchReason) lines.push(`匹配理由：${profile.matchReason}`);

  return lines.join("\n");
}

function buildIcebreakerPrompt(
  requesterProfile: IcebreakerProfile,
  targetProfile: IcebreakerProfile,
): string {
  return [
    "请根据以下双方资料，写一句可直接粘贴到会面邀请里的开场白：",
    "",
    formatProfile("发起人（我）", requesterProfile),
    "",
    formatProfile("对方", targetProfile),
    "",
    "只输出开场白正文，不要引号、不要标题、不要解释。",
  ].join("\n");
}

function sanitizeSuggestion(text: string): string {
  return text
    .trim()
    .replace(/^["'「『]|["'」』]$/g, "")
    .replace(/\s+/g, " ")
    .slice(0, MAX_SUGGESTION_CHARS);
}

export async function generateMeetingIcebreaker(input: {
  requesterProfile: IcebreakerProfile;
  targetProfile: IcebreakerProfile;
}): Promise<string> {
  if (!isLLMConfigured()) {
    throw new LlmError("AI 服务未配置", "NOT_CONFIGURED");
  }

  const suggestion = await callLLMText({
    system: ICEBREAKER_SYSTEM,
    prompt: buildIcebreakerPrompt(
      input.requesterProfile,
      input.targetProfile,
    ),
    maxTokens: 120,
    temperature: 0.7,
  });

  const cleaned = sanitizeSuggestion(suggestion);
  if (!cleaned) {
    throw new LlmError("AI 未返回有效开场白", "PROVIDER_ERROR");
  }

  return cleaned;
}
