import { ErrorCode } from "@connectiq/types";
import { z } from "zod";
import {
  createErrorResponse,
  createSuccessResponse,
  requireEventAccess,
  withErrorHandler,
} from "@/lib/api-auth";
import {
  broadcastToEvent,
  pushStampReminderForBooths,
} from "@/lib/live-ops-service";

const broadcastSchema = z
  .object({
    title: z.string().min(1).max(120).optional(),
    body: z.string().min(1).max(2000).optional(),
    urgent: z.boolean().optional(),
    stamp_booth_ids: z.array(z.string()).optional(),
  })
  .refine(
    (data) =>
      data.stamp_booth_ids?.length ||
      (data.title && data.body),
    { message: "请填写标题和内容，或指定展位" },
  );

export const POST = withErrorHandler(async (request, context) => {
  const eventId = context?.params?.eventId;
  if (!eventId) {
    return createErrorResponse("缺少活动 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  await requireEventAccess(eventId);

  const body = await request.json().catch(() => ({}));
  const parsed = broadcastSchema.safeParse(body);
  if (!parsed.success) {
    return createErrorResponse("参数错误", ErrorCode.VALIDATION_ERROR, 400);
  }

  if (parsed.data.stamp_booth_ids?.length) {
    const result = await pushStampReminderForBooths(
      eventId,
      parsed.data.stamp_booth_ids,
    );
    return createSuccessResponse(result);
  }

  const result = await broadcastToEvent(eventId, {
    title: parsed.data.title!,
    body: parsed.data.body!,
    urgent: parsed.data.urgent,
  });

  return createSuccessResponse(result);
});
