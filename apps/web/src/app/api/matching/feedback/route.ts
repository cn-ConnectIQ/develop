import { ErrorCode } from "@connectiq/types";
import { z } from "zod";
import {
  ApiError,
  createErrorResponse,
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api-auth";
import {
  analyzeMatchFeedbackWeights,
  runOfflineMatchWeightTuning,
} from "@/lib/ai/matching/match-feedback-analysis";
import { submitMatchFeedbackFromClient } from "@/lib/ai/matching/match-feedback-service";
import { requireMobileAuth } from "@/lib/mobile-user-id";

const feedbackBodySchema = z.object({
  target_id: z.string().min(1),
  event_id: z.string().min(1),
  signal: z.enum(["EXCHANGED", "MEETING", "VIEWED", "IGNORED", "DECLINED"]),
  match_score: z.number().optional(),
});

/**
 * POST — 上报推荐反馈（忽略、查看名片等客户端主动信号）
 * GET  ?event_id=&analyze=1 — 离线维度采纳统计（管理/调试）
 */
export const POST = withErrorHandler(async (request) => {
  const { userId } = await requireMobileAuth(request);
  const body = feedbackBodySchema.safeParse(await request.json());

  if (!body.success) {
    return createErrorResponse(
      body.error.issues[0]?.message ?? "参数无效",
      ErrorCode.VALIDATION_ERROR,
      400,
    );
  }

  try {
    const result = await submitMatchFeedbackFromClient(userId, body.data);
    return createSuccessResponse(result);
  } catch {
    throw new ApiError("无效的反馈信号", ErrorCode.VALIDATION_ERROR, 400);
  }
});

export const GET = withErrorHandler(async (request) => {
  await requireMobileAuth(request);

  const { searchParams } = new URL(request.url);
  const eventId = searchParams.get("event_id") ?? undefined;
  const analyze = searchParams.get("analyze") === "1";
  const persist = searchParams.get("persist") === "1";

  if (persist) {
    if (!eventId) {
      return createErrorResponse(
        "persist 需指定 event_id",
        ErrorCode.VALIDATION_ERROR,
        400,
      );
    }
    const tuning = await runOfflineMatchWeightTuning(eventId);
    return createSuccessResponse({ tuning });
  }

  if (analyze) {
    const analysis = await analyzeMatchFeedbackWeights(eventId);
    return createSuccessResponse({ analysis });
  }

  return createErrorResponse(
    "请使用 analyze=1 或 persist=1 查询参数",
    ErrorCode.VALIDATION_ERROR,
    400,
  );
});
