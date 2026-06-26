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
    role: z.string().max(64).optional().nullable(),
    supply_tags: z.array(z.string().max(64)).max(20).optional(),
    demand_tags: z.array(z.string().max(64)).max(20).optional(),
    topics: z.array(z.string().max(64)).max(20).optional(),
  })
  .refine(
    (data) =>
      data.role !== undefined ||
      data.supply_tags !== undefined ||
      data.demand_tags !== undefined ||
      data.topics !== undefined,
    { message: "请至少提供一个字段（role / supply_tags / demand_tags / topics）" },
  );

/** 参会者读取当前活动的意向采集结果 */
export const GET = withErrorHandler(async (request, context) => {
  const eventId = context?.params?.eventId;
  if (!eventId) {
    return createErrorResponse("缺少活动 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  const userId = await resolveMobileUserId(request);
  const intent = await getMyEventIntent(eventId, userId);
  return createSuccessResponse(intent);
});

/** 参会者提交/更新意向（供小程序 MT7） */
export const PATCH = withErrorHandler(async (request, context) => {
  const eventId = context?.params?.eventId;
  if (!eventId) {
    return createErrorResponse("缺少活动 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

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

  const intent = await upsertMyEventIntent(eventId, userId, parsed.data);
  return createSuccessResponse(intent);
});
