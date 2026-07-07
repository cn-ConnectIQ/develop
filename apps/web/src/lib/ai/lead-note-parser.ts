import {
  callLLM,
  isLLMConfigured,
  LlmError,
  parseJSONResponse,
} from "@/lib/ai/llm";

export type ParsedLeadNote = {
  需求: string;
  预算: string;
  下一步: string;
};

export type LeadAiSummary = {
  requirement: string;
  budget: string;
  next_step: string;
};

const LEAD_NOTE_PARSE_SYSTEM = `你是B2B展会的销售笔记整理助手。把销售人员的口语化备注
(可能来自语音转文字),提炼成结构化的CRM字段。
严格要求:只提取备注里明确提到的信息,没提到的字段留空,不要编造。`;

const EMPTY_PARSED: ParsedLeadNote = {
  需求: "",
  预算: "",
  下一步: "",
};

function buildLeadNotePrompt(rawNote: string): string {
  return `销售笔记原文:「${rawNote}」

请返回JSON: {
  "需求": "提取到的需求描述,没有则为空字符串",
  "预算": "提取到的预算信息,没有则为空字符串",
  "下一步": "提取到的下一步行动,没有则为空字符串"
}`;
}

function normalizeParsedLeadNote(raw: Partial<ParsedLeadNote>): ParsedLeadNote {
  return {
    需求: typeof raw.需求 === "string" ? raw.需求.trim() : "",
    预算: typeof raw.预算 === "string" ? raw.预算.trim() : "",
    下一步: typeof raw.下一步 === "string" ? raw.下一步.trim() : "",
  };
}

export function toLeadAiSummary(parsed: ParsedLeadNote): LeadAiSummary {
  return {
    requirement: parsed.需求,
    budget: parsed.预算,
    next_step: parsed.下一步,
  };
}

export function formatStructuredNote(
  parsed: ParsedLeadNote | LeadAiSummary,
): string {
  const requirement =
    "需求" in parsed ? parsed.需求 : parsed.requirement;
  const budget = "预算" in parsed ? parsed.预算 : parsed.budget;
  const nextStep = "下一步" in parsed ? parsed.下一步 : parsed.next_step;

  const parts = [
    requirement ? `需求：${requirement}` : null,
    budget ? `预算：${budget}` : null,
    nextStep ? `下一步：${nextStep}` : null,
  ].filter(Boolean);

  return parts.join("；");
}

export function hasParsedLeadNoteContent(parsed: ParsedLeadNote): boolean {
  return Boolean(parsed.需求 || parsed.预算 || parsed.下一步);
}

/**
 * 将销售口语化备注解析为结构化 CRM 字段。
 * LLM 未配置或原文为空时返回空字段。
 */
export async function parseLeadNote(rawNote: string): Promise<ParsedLeadNote> {
  const trimmed = rawNote.trim();
  if (!trimmed) return EMPTY_PARSED;

  if (!isLLMConfigured()) {
    throw new LlmError("AI 服务未配置", "NOT_CONFIGURED");
  }

  const result = await callLLM({
    system: LEAD_NOTE_PARSE_SYSTEM,
    prompt: buildLeadNotePrompt(trimmed),
    jsonMode: true,
    maxTokens: 512,
    temperature: 0.2,
  });

  return normalizeParsedLeadNote(parseJSONResponse<ParsedLeadNote>(result.text));
}

/** 保存线索时使用：解析失败不阻塞写入 */
export async function tryParseLeadNote(
  rawNote: string,
): Promise<ParsedLeadNote | null> {
  const trimmed = rawNote.trim();
  if (!trimmed || !isLLMConfigured()) return null;

  try {
    const parsed = await parseLeadNote(trimmed);
    return hasParsedLeadNoteContent(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
