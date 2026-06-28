import { ErrorCode } from "@connectiq/types";
import { z } from "zod";
import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api-auth";
import { resolveMobileUserId } from "@/lib/mobile-user-id";
import {
  getMyEventIntent,
  upsertMyEventIntent,
} from "@/lib/user-event-intent-service";

const patchBodySchema = z
  .object({
    event_id: z.string().min(1),
    role: z.string().max(64).optional().nullable(),
    supply_tags: z.array(z.string().max(64)).max(20).optional(),
    demand_tags: z.array(z.string().max(64)).max(20).optional(),
    topics: z.array(z.string().max(64)).max(20).optional(),
    industry: z.string().max(64).optional().nullable(),
    region: z.string().max(64).optional().nullable(),
    raw_intent_text: z.string().max(2000).optional().nullable(),
    /** 仅保存原文，批量 cron 再解析（导入场景） */
    defer_llm_parse: z.boolean().optional(),
  })
  .refine(
    (data) =>
      data.role !== undefined ||
      data.supply_tags !== undefined ||
      data.demand_tags !== undefined ||
      data.topics !== undefined ||
      data.industry !== undefined ||
      data.region !== undefined ||
      data.raw_intent_text !== undefined,
    {
      message:
        "请至少提供一个字段（role / supply_tags / demand_tags / topics / industry / region / raw_intent_text）",
    },
  );

/** 读取当前用户在某活动的意向（含 LLM 解析结果） */
export const GET = withErrorHandler(async (request) => {
  const { searchParams } = new URL(request.url);
  const eventId = searchParams.get("event_id");

  if (!eventId) {
    return createErrorResponse(
      "缺少 event_id 查询参数",
      ErrorCode.VALIDATION_ERROR,
      400,
    );
  }

  const userId = await resolveMobileUserId(request);
  const intent = await getMyEventIntent(eventId, userId);
  return createSuccessResponse(intent);
});

/**
 * 提交/更新活动意向。
 * 含 raw_intent_text 时调用 LLM 补全结构化标签（报名/激活场景）；
 * defer_llm_parse=true 时仅落库，留待批量解析。
 */
export const PATCH = withErrorHandler(async (request) => {
  const userId = await resolveMobileUserId(request);
  const body = await request.json().catch(() => ({}));
  const parsed = patchBodySchema.safeParse(body);

  if (!parsed.success) {
    return createErrorResponse(
      parsed.error.issues[0]?.message ?? "参数校验失败",
      ErrorCode.VALIDATION_ERROR,
      400,
    );
  }

  const { event_id: eventId, ...input } = parsed.data;
  const intent = await upsertMyEventIntent(eventId, userId, input);
  return createSuccessResponse(intent);
});
