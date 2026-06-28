import { AiGenerationType, IntentTagPool, prisma } from "@connectiq/database";
import { embedAndSaveUserEventIntent } from "@/lib/ai/embedding";
import { callLLM, isLLMConfigured, LlmError } from "@/lib/ai/llm";
import {
  buildEventIntentParsePrompt,
  EVENT_INTENT_PARSE_SYSTEM,
  type EventTagLibrary,
  type ParsedEventIntent,
} from "@/lib/ai/prompts/event-intent-parse";
import {
  DEFAULT_INTENT_CONFIG,
  parseIntentConfig,
} from "@/lib/matchmaking-config";

const PROMPT_VERSION = "event-intent-v1";
const MAX_TAGS_PER_FIELD = 8;

function normalizeTagList(tags: string[] | undefined | null): string[] {
  if (!tags) return [];
  return [
    ...new Set(
      tags
        .map((t) => (typeof t === "string" ? t.trim() : ""))
        .filter(Boolean)
        .slice(0, MAX_TAGS_PER_FIELD),
    ),
  ];
}

function normalizeOptionalString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** 标签归一：优先匹配活动标签库中的标准文案 */
function resolveTag(label: string, library: string[]): string | null {
  const trimmed = label.trim();
  if (!trimmed) return null;

  const exact = library.find((item) => item === trimmed);
  if (exact) return exact;

  const lower = trimmed.toLowerCase();
  const ci = library.find((item) => item.toLowerCase() === lower);
  if (ci) return ci;

  const partial = library.find(
    (item) =>
      item.includes(trimmed) ||
      trimmed.includes(item) ||
      item.toLowerCase().includes(lower) ||
      lower.includes(item.toLowerCase()),
  );
  return partial ?? trimmed;
}

function resolveTags(
  labels: string[],
  library: string[],
  allowCustom: boolean,
): string[] {
  const resolved: string[] = [];
  for (const label of labels) {
    const libMatch = library.find(
      (item) =>
        item === label.trim() ||
        item.toLowerCase() === label.trim().toLowerCase(),
    );
    if (libMatch) {
      resolved.push(libMatch);
      continue;
    }
    const mapped = resolveTag(label, library);
    if (!mapped) continue;
    if (library.includes(mapped) || allowCustom) {
      resolved.push(mapped);
    }
  }
  return normalizeTagList(resolved);
}

function resolveRole(role: unknown, roles: string[]): string | null {
  const value = normalizeOptionalString(role);
  if (!value || value === "null") return null;
  const match = roles.find(
    (r) => r === value || r.toLowerCase() === value.toLowerCase(),
  );
  return match ?? null;
}

function sanitizeParsedIntent(
  raw: Partial<ParsedEventIntent>,
  tagLibrary: EventTagLibrary,
  allowCustomTags: boolean,
): ParsedEventIntent {
  return {
    supply_tags: resolveTags(
      normalizeTagList(raw.supply_tags),
      tagLibrary.supply,
      allowCustomTags,
    ),
    demand_tags: resolveTags(
      normalizeTagList(raw.demand_tags),
      tagLibrary.demand,
      allowCustomTags,
    ),
    role: resolveRole(raw.role, tagLibrary.roles),
    topics: resolveTags(
      normalizeTagList(raw.topics),
      tagLibrary.topics,
      allowCustomTags,
    ),
    industry: normalizeOptionalString(raw.industry),
    region: normalizeOptionalString(raw.region),
  };
}

async function logIntentParse(
  rawText: string,
  tokensUsed: number,
  adopted: boolean,
) {
  try {
    await prisma.aiGenerationLog.create({
      data: {
        type: AiGenerationType.INTENT_PARSE,
        promptVersion: PROMPT_VERSION,
        tokensUsed,
        adopted,
        contentPreview: rawText.slice(0, 200),
      },
    });
  } catch {
    // 日志失败不影响主流程
  }
}

/** 加载活动标签库（IntentTag + 主办方 role 配置） */
export async function loadEventTagLibrary(
  eventId: string,
): Promise<EventTagLibrary & { allowCustomTags: boolean; eventName: string }> {
  const [tags, event] = await Promise.all([
    prisma.intentTag.findMany({
      where: { eventId },
      select: { label: true, pool: true },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.event.findUnique({
      where: { id: eventId },
      select: { name: true, intentConfig: true },
    }),
  ]);

  if (!event) {
    throw new Error("活动不存在");
  }

  const config = parseIntentConfig(event.intentConfig);
  const allowCustomTags =
    config.supply.allow_custom ||
    config.demand.allow_custom ||
    config.topics.allow_custom;

  return {
    eventName: event.name,
    allowCustomTags,
    supply: tags
      .filter((t) => t.pool === IntentTagPool.SUPPLY)
      .map((t) => t.label),
    demand: tags
      .filter((t) => t.pool === IntentTagPool.DEMAND)
      .map((t) => t.label),
    topics: tags
      .filter(
        (t) =>
          t.pool === IntentTagPool.TOPIC || t.pool === IntentTagPool.GENERAL,
      )
      .map((t) => t.label),
    roles:
      config.role.options.length > 0
        ? config.role.options
        : DEFAULT_INTENT_CONFIG.role.options,
  };
}

/**
 * 用大模型将自由文本解析为结构化意向标签。
 * LLM 未配置时返回空结构（由调用方保留用户手填标签）。
 */
export async function parseIntent(
  rawText: string,
  tagLibrary: EventTagLibrary,
  options?: {
    eventName?: string;
    allowCustomTags?: boolean;
  },
): Promise<ParsedEventIntent> {
  const trimmed = rawText.trim();
  if (!trimmed) {
    return {
      supply_tags: [],
      demand_tags: [],
      role: null,
      topics: [],
      industry: null,
      region: null,
    };
  }

  if (!isLLMConfigured()) {
    return {
      supply_tags: [],
      demand_tags: [],
      role: null,
      topics: [],
      industry: null,
      region: null,
    };
  }

  const allowCustomTags = options?.allowCustomTags ?? true;

  try {
    const result = await callLLM<ParsedEventIntent>({
      system: EVENT_INTENT_PARSE_SYSTEM,
      prompt: buildEventIntentParsePrompt({
        rawText: trimmed,
        tagLibrary,
        eventName: options?.eventName,
        allowCustomTags,
      }),
      jsonMode: true,
      maxTokens: 768,
      temperature: 0.1,
    });

    const parsed = sanitizeParsedIntent(
      result.parsed ?? {},
      tagLibrary,
      allowCustomTags,
    );

    void logIntentParse(
      trimmed,
      result.usage?.totalTokens ?? 0,
      parsed.supply_tags.length > 0 ||
        parsed.demand_tags.length > 0 ||
        parsed.topics.length > 0 ||
        Boolean(parsed.role),
    );

    return parsed;
  } catch (err) {
    if (err instanceof LlmError) {
      void logIntentParse(trimmed, 0, false);
    }
    throw err;
  }
}

/** 合并用户手填与 LLM 解析结果（用户手填优先，LLM 补全空缺） */
export function mergeParsedIntent(
  userInput: Partial<ParsedEventIntent>,
  parsed: ParsedEventIntent,
): ParsedEventIntent {
  const pickTags = (userTags: string[] | undefined, parsedTags: string[]) => {
    const user = normalizeTagList(userTags);
    if (user.length > 0) return user;
    return parsedTags;
  };

  return {
    supply_tags: pickTags(userInput.supply_tags, parsed.supply_tags),
    demand_tags: pickTags(userInput.demand_tags, parsed.demand_tags),
    role: userInput.role ?? parsed.role,
    topics: pickTags(userInput.topics, parsed.topics),
    industry: userInput.industry ?? parsed.industry,
    region: userInput.region ?? parsed.region,
  };
}

export type BatchParseResult = {
  processed: number;
  parsed: number;
  skipped: number;
  failed: number;
};

/**
 * 批量解析待处理意向（报名导入后 cron 调用）。
 * 条件：有 raw_intent_text 且尚未 intent_parsed_at。
 */
export async function batchParsePendingIntents(
  eventId: string,
  options?: { limit?: number },
): Promise<BatchParseResult> {
  const limit = options?.limit ?? 50;

  const pending = await prisma.userEventIntent.findMany({
    where: {
      eventId,
      rawIntentText: { not: null },
      intentParsedAt: null,
    },
    select: {
      id: true,
      userId: true,
      rawIntentText: true,
      supplyTags: true,
      demandTags: true,
      role: true,
      topics: true,
      industry: true,
      region: true,
    },
    take: limit,
    orderBy: { createdAt: "asc" },
  });

  if (pending.length === 0) {
    return { processed: 0, parsed: 0, skipped: 0, failed: 0 };
  }

  const library = await loadEventTagLibrary(eventId);
  const { eventName, allowCustomTags, ...tagLibrary } = library;

  let parsed = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of pending) {
    const raw = row.rawIntentText?.trim();
    if (!raw) {
      skipped++;
      continue;
    }

    try {
      const llmParsed = await parseIntent(raw, tagLibrary, {
        eventName,
        allowCustomTags,
      });

      const merged = mergeParsedIntent(
        {
          supply_tags: row.supplyTags,
          demand_tags: row.demandTags,
          role: row.role,
          topics: row.topics,
          industry: row.industry,
          region: row.region,
        },
        llmParsed,
      );

      await prisma.userEventIntent.update({
        where: { id: row.id },
        data: {
          supplyTags: merged.supply_tags,
          demandTags: merged.demand_tags,
          role: merged.role,
          topics: merged.topics,
          industry: merged.industry,
          region: merged.region,
          intentParsedAt: new Date(),
        },
      });

      void embedAndSaveUserEventIntent(row.userId, eventId, {
        rawIntentText: raw,
        role: merged.role,
        supplyTags: merged.supply_tags,
        demandTags: merged.demand_tags,
        topics: merged.topics,
        industry: merged.industry,
        region: merged.region,
      });

      parsed++;
    } catch {
      failed++;
    }
  }

  return {
    processed: pending.length,
    parsed,
    skipped,
    failed,
  };
}
