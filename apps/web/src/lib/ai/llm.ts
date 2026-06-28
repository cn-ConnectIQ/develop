/**
 * 大模型调用抽象层 — 换 provider 只改此文件。
 *
 * 环境变量：
 *   LLM_PROVIDER  deepseek | dashscope | zhipu
 *   LLM_API_KEY   API 密钥
 *   LLM_MODEL     模型名（可选，各 provider 有默认值）
 *   LLM_BASE_URL  自定义 API 根地址（可选）
 */

export type LLMProvider = "deepseek" | "dashscope" | "zhipu";

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

type ProviderConfig = {
  baseUrl: string;
  defaultModel: string;
  supportsJsonMode: boolean;
};

const PROVIDER_DEFAULTS: Record<LLMProvider, ProviderConfig> = {
  deepseek: {
    baseUrl: "https://api.deepseek.com",
    defaultModel: "deepseek-chat",
    supportsJsonMode: true,
  },
  dashscope: {
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    defaultModel: "qwen-plus",
    supportsJsonMode: true,
  },
  zhipu: {
    baseUrl: "https://open.bigmodel.cn/api/paas/v4",
    defaultModel: "glm-4-flash",
    supportsJsonMode: true,
  },
};

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_TOKENS = 1024;
const DEFAULT_TEMPERATURE = 0.3;
const MAX_RETRIES = 2;
const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504]);

function resolveProvider(): LLMProvider {
  const raw = (process.env.LLM_PROVIDER ?? "deepseek").trim().toLowerCase();
  if (raw === "deepseek" || raw === "dashscope" || raw === "zhipu") {
    return raw;
  }
  throw new LlmError(
    `不支持的 LLM_PROVIDER: ${raw}（可选 deepseek | dashscope | zhipu）`,
    "NOT_CONFIGURED",
  );
}

function resolveConfig() {
  const provider = resolveProvider();
  const defaults = PROVIDER_DEFAULTS[provider];
  const apiKey = process.env.LLM_API_KEY?.trim();
  if (!apiKey) {
    throw new LlmError(
      "未配置 LLM_API_KEY，无法调用大模型",
      "NOT_CONFIGURED",
    );
  }

  const baseUrl = (
    process.env.LLM_BASE_URL?.trim() || defaults.baseUrl
  ).replace(/\/$/, "");
  const model = process.env.LLM_MODEL?.trim() || defaults.defaultModel;

  return { provider, apiKey, baseUrl, model, defaults };
}

/** 是否已配置可用的 LLM（不发起网络请求） */
export function isLLMConfigured(): boolean {
  try {
    resolveConfig();
    return true;
  } catch {
    return false;
  }
}

/** 去掉 ```json ... ``` 包裹并提取 JSON 文本 */
export function parseJsonFromLLM<T = unknown>(text: string): T {
  let raw = text.trim();

  const fenced = raw.match(/^```(?:json)?\s*([\s\S]*?)```\s*$/i);
  if (fenced?.[1]) {
    raw = fenced[1].trim();
  } else {
    const inline = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (inline?.[1]) raw = inline[1].trim();
  }

  const start = raw.indexOf("{");
  const arrStart = raw.indexOf("[");
  const jsonStart =
    start === -1
      ? arrStart
      : arrStart === -1
        ? start
        : Math.min(start, arrStart);

  if (jsonStart > 0) {
    raw = raw.slice(jsonStart);
  }

  const lastBrace = Math.max(raw.lastIndexOf("}"), raw.lastIndexOf("]"));
  if (lastBrace >= 0) {
    raw = raw.slice(0, lastBrace + 1);
  }

  try {
    return JSON.parse(raw) as T;
  } catch (err) {
    throw new LlmError(
      "模型返回的内容无法解析为 JSON",
      "PARSE_ERROR",
      undefined,
      err,
    );
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type ChatCompletionResponse = {
  choices?: Array<{ message?: { content?: string | null } }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  error?: { message?: string; type?: string };
};

async function invokeProvider(
  config: ReturnType<typeof resolveConfig>,
  options: CallLLMOptions,
  signal: AbortSignal,
): Promise<{ text: string; usage?: CallLLMUsage }> {
  const body: Record<string, unknown> = {
    model: config.model,
    messages: [
      { role: "system", content: options.system },
      { role: "user", content: options.prompt },
    ],
    max_tokens: options.maxTokens ?? DEFAULT_MAX_TOKENS,
    temperature: options.temperature ?? DEFAULT_TEMPERATURE,
  };

  if (options.jsonMode && config.defaults.supportsJsonMode) {
    body.response_format = { type: "json_object" };
  }

  const res = await fetch(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal,
  });

  const payload = (await res.json().catch(() => ({}))) as ChatCompletionResponse;

  if (!res.ok) {
    const msg =
      payload.error?.message ??
      `LLM HTTP ${res.status}`;
    throw new LlmError(msg, "HTTP_ERROR", res.status);
  }

  const text = payload.choices?.[0]?.message?.content?.trim();
  if (!text) {
    throw new LlmError("模型返回空内容", "PROVIDER_ERROR");
  }

  return {
    text,
    usage: payload.usage
      ? {
          promptTokens: payload.usage.prompt_tokens,
          completionTokens: payload.usage.completion_tokens,
          totalTokens: payload.usage.total_tokens,
        }
      : undefined,
  };
}

function isRetryable(err: unknown): boolean {
  if (err instanceof LlmError) {
    if (err.code === "TIMEOUT") return true;
    if (err.code === "HTTP_ERROR" && err.status && RETRYABLE_STATUS.has(err.status)) {
      return true;
    }
  }
  if (err instanceof Error && err.name === "AbortError") return true;
  return false;
}

/**
 * 调用大模型。jsonMode=true 时自动解析 JSON 并写入 result.parsed。
 */
export async function callLLM<T = unknown>(
  options: CallLLMOptions,
): Promise<CallLLMResult<T>> {
  const config = resolveConfig();
  let lastError: unknown;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      await sleep(400 * 2 ** (attempt - 1));
    }

    try {
      const { text, usage } = await invokeProvider(
        config,
        options,
        AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
      );

      const result: CallLLMResult<T> = {
        text,
        usage,
        provider: config.provider,
        model: config.model,
      };

      if (options.jsonMode) {
        result.parsed = parseJsonFromLLM<T>(text);
      }

      return result;
    } catch (err) {
      lastError = err;

      if (err instanceof Error && err.name === "TimeoutError") {
        lastError = new LlmError(
          `LLM 请求超时（${DEFAULT_TIMEOUT_MS}ms）`,
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

  if (lastError instanceof LlmError) throw lastError;
  throw new LlmError(
    lastError instanceof Error ? lastError.message : "LLM 调用失败",
    "PROVIDER_ERROR",
    undefined,
    lastError,
  );
}
