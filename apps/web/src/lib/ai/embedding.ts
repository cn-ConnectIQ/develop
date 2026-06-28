import { prisma } from "@connectiq/database";

/** 与 schema UserEventIntent.embedding vector(1024) 一致 */
export const EMBEDDING_DIMENSIONS = 1024;

export type EmbeddingProvider = "dashscope" | "zhipu";

export class EmbeddingError extends Error {
  constructor(
    message: string,
    readonly code:
      | "NOT_CONFIGURED"
      | "TIMEOUT"
      | "HTTP_ERROR"
      | "INVALID_RESPONSE"
      | "PROVIDER_ERROR",
    readonly status?: number,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "EmbeddingError";
  }
}

type ProviderConfig = {
  baseUrl: string;
  defaultModel: string;
  dimensions: number;
};

const PROVIDER_DEFAULTS: Record<EmbeddingProvider, ProviderConfig> = {
  dashscope: {
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    defaultModel: "text-embedding-v3",
    dimensions: EMBEDDING_DIMENSIONS,
  },
  zhipu: {
    baseUrl: "https://open.bigmodel.cn/api/paas/v4",
    defaultModel: "embedding-2",
    dimensions: EMBEDDING_DIMENSIONS,
  },
};

const DEFAULT_TIMEOUT_MS = 20_000;
const MAX_RETRIES = 2;
const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504]);

export type IntentEmbedInput = {
  rawIntentText?: string | null;
  role?: string | null;
  supplyTags?: string[];
  demandTags?: string[];
  topics?: string[];
  industry?: string | null;
  region?: string | null;
};

function resolveProvider(): EmbeddingProvider {
  const raw = (
    process.env.EMBEDDING_PROVIDER ??
    process.env.LLM_PROVIDER ??
    "dashscope"
  )
    .trim()
    .toLowerCase();

  if (raw === "dashscope" || raw === "zhipu") {
    return raw;
  }
  if (raw === "deepseek") {
    return "dashscope";
  }
  throw new EmbeddingError(
    `不支持的 EMBEDDING_PROVIDER: ${raw}（可选 dashscope | zhipu）`,
    "NOT_CONFIGURED",
  );
}

function resolveConfig() {
  const provider = resolveProvider();
  const defaults = PROVIDER_DEFAULTS[provider];
  const apiKey = (
    process.env.EMBEDDING_API_KEY?.trim() || process.env.LLM_API_KEY?.trim()
  );
  if (!apiKey) {
    throw new EmbeddingError(
      "未配置 EMBEDDING_API_KEY / LLM_API_KEY，无法生成向量",
      "NOT_CONFIGURED",
    );
  }

  const baseUrl = (
    process.env.EMBEDDING_BASE_URL?.trim() || defaults.baseUrl
  ).replace(/\/$/, "");
  const model =
    process.env.EMBEDDING_MODEL?.trim() || defaults.defaultModel;
  const dimensions = Number(
    process.env.EMBEDDING_DIMENSIONS ?? defaults.dimensions,
  );

  return { provider, apiKey, baseUrl, model, dimensions };
}

export function isEmbeddingConfigured(): boolean {
  try {
    resolveConfig();
    return true;
  } catch {
    return false;
  }
}

/** 将意向字段拼成用于 embedding 的文本（优先自由文本） */
export function buildIntentEmbedText(input: IntentEmbedInput): string {
  const raw = input.rawIntentText?.trim();
  if (raw) return raw;

  const parts: string[] = [];
  if (input.role) parts.push(`角色：${input.role}`);
  if (input.industry) parts.push(`行业：${input.industry}`);
  if (input.region) parts.push(`地域：${input.region}`);
  if (input.supplyTags?.length) {
    parts.push(`可提供：${input.supplyTags.join("、")}`);
  }
  if (input.demandTags?.length) {
    parts.push(`寻找：${input.demandTags.join("、")}`);
  }
  if (input.topics?.length) {
    parts.push(`关注：${input.topics.join("、")}`);
  }
  return parts.join("\n").trim();
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeVector(values: number[], dimensions: number): number[] {
  if (values.length === dimensions) return values;
  if (values.length > dimensions) return values.slice(0, dimensions);
  return [...values, ...Array(dimensions - values.length).fill(0)];
}

type EmbeddingsResponse = {
  data?: Array<{ embedding?: number[] }>;
  error?: { message?: string };
};

async function invokeEmbeddingProvider(
  config: ReturnType<typeof resolveConfig>,
  text: string,
  signal: AbortSignal,
): Promise<number[]> {
  const body: Record<string, unknown> = {
    model: config.model,
    input: text,
  };

  if (config.provider === "dashscope") {
    body.dimensions = config.dimensions;
  }

  const res = await fetch(`${config.baseUrl}/embeddings`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal,
  });

  const payload = (await res.json().catch(() => ({}))) as EmbeddingsResponse;

  if (!res.ok) {
    const msg = payload.error?.message ?? `Embedding HTTP ${res.status}`;
    throw new EmbeddingError(msg, "HTTP_ERROR", res.status);
  }

  const embedding = payload.data?.[0]?.embedding;
  if (!embedding?.length) {
    throw new EmbeddingError("Embedding 返回空向量", "INVALID_RESPONSE");
  }

  return normalizeVector(embedding, config.dimensions);
}

function isRetryable(err: unknown): boolean {
  if (err instanceof EmbeddingError) {
    if (err.code === "TIMEOUT") return true;
    if (
      err.code === "HTTP_ERROR" &&
      err.status &&
      RETRYABLE_STATUS.has(err.status)
    ) {
      return true;
    }
  }
  if (err instanceof Error && err.name === "AbortError") return true;
  return false;
}

/**
 * 将用户意向/简介转为 embedding 向量（使用 embedding 模型，成本低于 chat LLM）。
 */
export async function embedIntent(intentText: string): Promise<number[]> {
  const trimmed = intentText.trim();
  if (!trimmed) {
    throw new EmbeddingError("意向文本为空", "INVALID_RESPONSE");
  }

  const config = resolveConfig();
  let lastError: unknown;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      await sleep(300 * 2 ** (attempt - 1));
    }

    try {
      return await invokeEmbeddingProvider(
        config,
        trimmed,
        AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
      );
    } catch (err) {
      lastError = err;

      if (err instanceof Error && err.name === "TimeoutError") {
        lastError = new EmbeddingError(
          `Embedding 请求超时（${DEFAULT_TIMEOUT_MS}ms）`,
          "TIMEOUT",
          undefined,
          err,
        );
      }

      if (attempt < MAX_RETRIES && isRetryable(lastError)) {
        continue;
      }
      break;
    }
  }

  if (lastError instanceof EmbeddingError) throw lastError;
  throw new EmbeddingError(
    lastError instanceof Error ? lastError.message : "Embedding 调用失败",
    "PROVIDER_ERROR",
    undefined,
    lastError,
  );
}

export function vectorToPgLiteral(vector: number[]): string {
  return `[${vector.map((v) => (Number.isFinite(v) ? v : 0)).join(",")}]`;
}

function parsePgVector(text: string): number[] | null {
  try {
    const parsed = JSON.parse(text) as unknown;
    if (!Array.isArray(parsed)) return null;
    return parsed.filter((v): v is number => typeof v === "number");
  } catch {
    return null;
  }
}

let pgVectorReady: boolean | null = null;

export async function isPgVectorReady(): Promise<boolean> {
  if (pgVectorReady !== null) return pgVectorReady;
  try {
    const rows = await prisma.$queryRawUnsafe<Array<{ exists: boolean }>>(
      `SELECT EXISTS(
         SELECT 1 FROM pg_extension WHERE extname = 'vector'
       ) AS exists`,
    );
    pgVectorReady = Boolean(rows[0]?.exists);
  } catch {
    pgVectorReady = false;
  }
  return pgVectorReady;
}

export async function loadUserEventIntentEmbedding(
  userId: string,
  eventId: string,
): Promise<number[] | null> {
  if (!(await isPgVectorReady())) return null;

  const rows = await prisma.$queryRawUnsafe<Array<{ embedding: string }>>(
    `SELECT embedding::text AS embedding
     FROM user_event_intents
     WHERE user_id = $1 AND event_id = $2 AND embedding IS NOT NULL`,
    userId,
    eventId,
  );

  const raw = rows[0]?.embedding;
  if (!raw) return null;
  return parsePgVector(raw);
}

export async function saveUserEventIntentEmbedding(
  userId: string,
  eventId: string,
  vector: number[],
): Promise<void> {
  if (!(await isPgVectorReady())) return;

  const literal = vectorToPgLiteral(vector);
  await prisma.$executeRawUnsafe(
    `UPDATE user_event_intents
     SET embedding = $1::vector, updated_at = NOW()
     WHERE user_id = $2 AND event_id = $3`,
    literal,
    userId,
    eventId,
  );
}

export type VectorSimilarHit = {
  userId: string;
  similarity: number;
};

export type VectorRecallOptions = {
  limit?: number;
  minSimilarity?: number;
  excludedUserIds?: Set<string>;
};

/**
 * 在本活动用户中做 pgvector 余弦相似度检索。
 * 需 viewer 已有 embedding；召回阶段不触发新生成。
 */
export async function querySimilarIntentEmbeddings(
  viewerId: string,
  eventId: string,
  queryVector: number[],
  options?: VectorRecallOptions,
): Promise<VectorSimilarHit[]> {
  if (!(await isPgVectorReady())) return [];

  const limit = options?.limit ?? 20;
  const minSimilarity = options?.minSimilarity ?? 0.62;
  const excluded = options?.excludedUserIds ?? new Set<string>();
  excluded.add(viewerId);

  const literal = vectorToPgLiteral(queryVector);

  const rows = await prisma.$queryRawUnsafe<
    Array<{ user_id: string; similarity: number }>
  >(
    `SELECT
       uei.user_id,
       1 - (uei.embedding <=> $1::vector) AS similarity
     FROM user_event_intents uei
     WHERE uei.event_id = $2
       AND uei.user_id != $3
       AND uei.embedding IS NOT NULL
     ORDER BY uei.embedding <=> $1::vector
     LIMIT $4`,
    literal,
    eventId,
    viewerId,
    limit + excluded.size,
  );

  const hits: VectorSimilarHit[] = [];
  for (const row of rows) {
    if (excluded.has(row.user_id)) continue;
    const similarity = Number(row.similarity);
    if (!Number.isFinite(similarity) || similarity < minSimilarity) continue;
    hits.push({ userId: row.user_id, similarity });
    if (hits.length >= limit) break;
  }

  return hits;
}

/** 生成并持久化用户活动意向 embedding（报名/激活/批量解析后调用） */
export async function embedAndSaveUserEventIntent(
  userId: string,
  eventId: string,
  input: IntentEmbedInput,
): Promise<boolean> {
  if (!isEmbeddingConfigured()) return false;
  if (!(await isPgVectorReady())) return false;

  const text = buildIntentEmbedText(input);
  if (!text) return false;

  try {
    const vector = await embedIntent(text);
    await saveUserEventIntentEmbedding(userId, eventId, vector);
    return true;
  } catch {
    return false;
  }
}

export type BatchEmbedResult = {
  processed: number;
  embedded: number;
  skipped: number;
  failed: number;
};

/**
 * 批量为尚未生成 embedding 的意向补向量（cron / 导入后）。
 */
export async function batchEmbedPendingIntents(
  eventId: string,
  options?: { limit?: number },
): Promise<BatchEmbedResult> {
  const limit = options?.limit ?? 50;

  if (!isEmbeddingConfigured() || !(await isPgVectorReady())) {
    return { processed: 0, embedded: 0, skipped: 0, failed: 0 };
  }

  const rows = await prisma.$queryRawUnsafe<
    Array<{
      user_id: string;
      raw_intent_text: string | null;
      role: string | null;
      supply_tags: string[];
      demand_tags: string[];
      topics: string[];
      industry: string | null;
      region: string | null;
    }>
  >(
    `SELECT
       user_id,
       raw_intent_text,
       role,
       supply_tags,
       demand_tags,
       topics,
       industry,
       region
     FROM user_event_intents
     WHERE event_id = $1
       AND embedding IS NULL
       AND (
         raw_intent_text IS NOT NULL
         OR cardinality(supply_tags) > 0
         OR cardinality(demand_tags) > 0
         OR cardinality(topics) > 0
         OR role IS NOT NULL
         OR industry IS NOT NULL
       )
     ORDER BY created_at ASC
     LIMIT $2`,
    eventId,
    limit,
  );

  let embedded = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of rows) {
    const text = buildIntentEmbedText({
      rawIntentText: row.raw_intent_text,
      role: row.role,
      supplyTags: row.supply_tags,
      demandTags: row.demand_tags,
      topics: row.topics,
      industry: row.industry,
      region: row.region,
    });

    if (!text) {
      skipped++;
      continue;
    }

    const ok = await embedAndSaveUserEventIntent(row.user_id, eventId, {
      rawIntentText: row.raw_intent_text,
      role: row.role,
      supplyTags: row.supply_tags,
      demandTags: row.demand_tags,
      topics: row.topics,
      industry: row.industry,
      region: row.region,
    });

    if (ok) embedded++;
    else failed++;
  }

  return {
    processed: rows.length,
    embedded,
    skipped,
    failed,
  };
}
