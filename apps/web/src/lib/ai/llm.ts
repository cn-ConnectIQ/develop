/**
 * 统一大模型调用层 — DeepSeek（OpenAI 兼容 SDK）
 *
 * 环境变量：
 *   DEEPSEEK_API_KEY   API 密钥（必填）
 *   DEEPSEEK_MODEL     模型名，默认 deepseek-v4-flash
 *
 * 兼容旧变量（迁移期）：
 *   LLM_API_KEY        未配置 DEEPSEEK_API_KEY 时回退使用
 */

import OpenAI from "openai";

export type LLMProvider = "deepseek";

export type CallLLMOptions = {
  system: string;
  prompt: string;
  jsonMode?: boolean;
  maxTokens?: number;
  temperature?: number;
};

export type CallLLMUsage = {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
};

export type CallLLMResult<T = unknown> = {
  text: string;
  parsed?: T;
  usage?: CallLLMUsage;
  provider: LLMProvider;
  model: string;
};

export class LlmError extends Error {
  constructor(
    message: string,
    readonly code:
      | "NOT_CONFIGURED"
      | "TIMEOUT"
      | "HTTP_ERROR"
      | "PARSE_ERROR"
      | "PROVIDER_ERROR",
    readonly status?: number,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "LlmError";
  }
}

const DEEPSEEK_BASE_URL = "https://api.deepseek.com";
const DEFAULT_MODEL = "deepseek-v4-flash";
const DEFAULT_MAX_TOKENS = 800;
const DEFAULT_TEMPERATURE = 0.5;
const REQUEST_TIMEOUT_MS = 15_000;
const MAX_RETRIES = 1;
const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504]);

function resolveApiKey(): string {
  const apiKey =
    process.env.DEEPSEEK_API_KEY?.trim() || process.env.LLM_API_KEY?.trim();
  if (!apiKey) {
    throw new LlmError(
      "未配置 DEEPSEEK_API_KEY，无法调用大模型",
      "NOT_CONFIGURED",
    );
  }
  return apiKey;
}

function resolveModel(): string {
  return process.env.DEEPSEEK_MODEL?.trim() || DEFAULT_MODEL;
}

function createClient(): OpenAI {
  return new OpenAI({
    apiKey: resolveApiKey(),
    baseURL: DEEPSEEK_BASE_URL,
    timeout: REQUEST_TIMEOUT_MS,
  });
}

/** 是否已配置可用的 LLM（不发起网络请求） */
export function isLLMConfigured(): boolean {
  try {
    resolveApiKey();
    return true;
  } catch {
    return false;
  }
}

/** jsonMode 时安全解析模型返回的 JSON（兼容 ```json 包裹） */
export function parseJSONResponse<T>(raw: string): T {
  const cleaned = raw.replace(/```json\s*|\s*```/g, "").trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch (err) {
    console.error("[LLM] JSON解析失败:", cleaned);
    throw new LlmError("AI返回格式异常", "PARSE_ERROR", undefined, err);
  }
}

/** @deprecated 请使用 parseJSONResponse；保留别名供旧代码引用 */
export const parseJsonFromLLM = parseJSONResponse;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryable(error: unknown): boolean {
  if (error instanceof OpenAI.APIConnectionError) return true;
  if (error instanceof OpenAI.APIError) {
    if (error.status && RETRYABLE_STATUS.has(error.status)) return true;
  }
  if (error instanceof LlmError) {
    if (error.code === "TIMEOUT") return true;
    if (
      error.code === "HTTP_ERROR" &&
      error.status &&
      RETRYABLE_STATUS.has(error.status)
    ) {
      return true;
    }
  }
  if (error instanceof Error) {
    if (error.name === "AbortError" || error.name === "TimeoutError") {
      return true;
    }
  }
  return false;
}

function toLlmError(error: unknown): LlmError {
  if (error instanceof LlmError) return error;

  if (error instanceof OpenAI.APIError) {
    const isTimeout =
      error.message.includes("timeout") ||
      error.message.includes("timed out") ||
      error.status === 408;
    if (isTimeout) {
      return new LlmError(
        `LLM 请求超时（${REQUEST_TIMEOUT_MS}ms）`,
        "TIMEOUT",
        error.status,
        error,
      );
    }
    return new LlmError(
      error.message || "AI服务暂时不可用,请稍后重试",
      "HTTP_ERROR",
      error.status,
      error,
    );
  }

  if (error instanceof OpenAI.APIConnectionError) {
    return new LlmError(
      "AI服务暂时不可用,请稍后重试",
      "TIMEOUT",
      undefined,
      error,
    );
  }

  if (error instanceof Error) {
    if (error.name === "AbortError" || error.name === "TimeoutError") {
      return new LlmError(
        `LLM 请求超时（${REQUEST_TIMEOUT_MS}ms）`,
        "TIMEOUT",
        undefined,
        error,
      );
    }
  }

  return new LlmError(
    "AI服务暂时不可用,请稍后重试",
    "PROVIDER_ERROR",
    undefined,
    error,
  );
}

/**
 * 调用 DeepSeek 大模型，返回原始文本与 token 用量。
 * 失败时抛出 LlmError，由调用方决定降级策略。
 */
async function invokeDeepSeek(
  options: CallLLMOptions,
): Promise<{ text: string; usage?: CallLLMUsage }> {
  const client = createClient();
  const model = resolveModel();
  let lastError: unknown;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      await sleep(400);
    }

    try {
      const response = await client.chat.completions.create({
        model,
        messages: [
          { role: "system", content: options.system },
          { role: "user", content: options.prompt },
        ],
        max_tokens: options.maxTokens ?? DEFAULT_MAX_TOKENS,
        temperature: options.temperature ?? DEFAULT_TEMPERATURE,
        ...(options.jsonMode ? { response_format: { type: "json_object" } } : {}),
      });

      const text = response.choices[0]?.message?.content?.trim();
      if (!text) {
        throw new LlmError("模型返回空内容", "PROVIDER_ERROR");
      }

      return {
        text,
        usage: response.usage
          ? {
              promptTokens: response.usage.prompt_tokens,
              completionTokens: response.usage.completion_tokens,
              totalTokens: response.usage.total_tokens,
            }
          : undefined,
      };
    } catch (error) {
      lastError = error;
      console.error("[LLM] DeepSeek call failed:", error);

      const llmError = toLlmError(error);
      lastError = llmError;

      if (attempt < MAX_RETRIES && isRetryable(llmError)) {
        continue;
      }
      break;
    }
  }

  throw toLlmError(lastError);
}

/** 调用 DeepSeek 大模型，仅返回文本 */
export async function callLLMText(
  options: CallLLMOptions,
): Promise<string> {
  const { text } = await invokeDeepSeek(options);
  return text;
}

/**
 * 调用大模型。jsonMode=true 时自动解析 JSON 并写入 result.parsed。
 */
export async function callLLM<T = unknown>(
  options: CallLLMOptions,
): Promise<CallLLMResult<T>> {
  const model = resolveModel();

  try {
    const { text, usage } = await invokeDeepSeek(options);

    const result: CallLLMResult<T> = {
      text,
      usage,
      provider: "deepseek",
      model,
    };

    if (options.jsonMode) {
      result.parsed = parseJSONResponse<T>(text);
    }

    return result;
  } catch (error) {
    throw toLlmError(error);
  }
}
