import { ErrorCode } from "@connectiq/types";
import { z } from "zod";
import {
  createErrorResponse,
  createSuccessResponse,
  requireEventAccess,
  withErrorHandler,
} from "@/lib/api-auth";
import {
  pushLotteryToAttendees,
  pushPollToAttendees,
} from "@/lib/interaction-push-service";
import { guardEventFeature } from "@/lib/event-feature-flag-guard";

const pushSchema = z.object({
  kind: z.enum(["poll", "lottery", "qna"]),
  id: z.string().cuid(),
});

/** 手动推送互动到全场参会者（主办方） */
export const POST = withErrorHandler(async (request, context) => {
  const eventId = context?.params?.eventId;
  if (!eventId) {
    return createErrorResponse("缺少活动 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  await requireEventAccess(eventId);

  const body = await request.json();
  const parsed = pushSchema.safeParse(body);
  if (!parsed.success) {
    return createErrorResponse("参数错误", ErrorCode.VALIDATION_ERROR, 400);
  }

  const { kind, id } = parsed.data;

  if (kind === "lottery") {
    const disabled = await guardEventFeature(eventId, "lottery");
    if (disabled) return disabled;
  }

  try {
    const result =
      kind === "lottery"
        ? await pushLotteryToAttendees(eventId, id)
        : await pushPollToAttendees(eventId, id);

    return createSuccessResponse(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "推送失败";
    return createErrorResponse(message, ErrorCode.VALIDATION_ERROR, 400);
  }
});
