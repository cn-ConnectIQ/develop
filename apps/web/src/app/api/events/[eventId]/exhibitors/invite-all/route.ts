import { ErrorCode } from "@connectiq/types";
import { z } from "zod";
import {
  ApiError,
  createErrorResponse,
  createSuccessResponse,
  requireEventAccess,
  withErrorHandler,
} from "@/lib/api-auth";
import { guardEventFeature } from "@/lib/event-feature-flag-guard";
import {
  assertExperienceCanBulkInvite,
} from "@/lib/experience/experience-invite-guards";
import { ExperienceAccountError } from "@/lib/experience/experience-account-service";
import { inviteAllExhibitors } from "@/lib/invite/send-fixed-invites";

const bodySchema = z.object({
  channel: z.enum(["SMS", "EMAIL", "AUTO"]).default("AUTO"),
  resend: z.boolean().optional(),
});

export const POST = withErrorHandler(async (request, context) => {
  const eventId = context?.params?.eventId;
  if (!eventId) {
    return createErrorResponse("缺少活动 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  const { session } = await requireEventAccess(eventId);
  const disabled = await guardEventFeature(eventId, "inviteSystem");
  if (disabled) return disabled;

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return createErrorResponse(
      parsed.error.issues[0]?.message ?? "参数错误",
      ErrorCode.VALIDATION_ERROR,
      400,
    );
  }

  try {
    await assertExperienceCanBulkInvite(session.user.id);
  } catch (error) {
    if (error instanceof ExperienceAccountError) {
      return createErrorResponse(error.message, ErrorCode.FORBIDDEN, 403);
    }
    throw error;
  }

  try {
    const result = await inviteAllExhibitors({
      eventId,
      channel: parsed.data.channel,
      createdBy: session.user.id,
      resend: parsed.data.resend,
    });

    if (result.totalExhibitors === 0) {
      return createErrorResponse(
        "当前没有可邀请的展商工作人员",
        ErrorCode.VALIDATION_ERROR,
        400,
      );
    }

    if (result.queued <= 0) {
      return createErrorResponse(
        "未能加入发送队列：请检查联系方式或邀请状态",
        ErrorCode.VALIDATION_ERROR,
        400,
      );
    }

    return createSuccessResponse({
      total_exhibitors: result.totalExhibitors,
      queued: result.queued,
      skipped: result.skipped,
      campaign_ids: result.campaignIds,
      channel: parsed.data.channel,
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 402) {
      return Response.json(
        {
          error: error.message,
          code: error.code,
          reason: "INSUFFICIENT_INVITE_CREDIT",
          redirect_to: "/organizer/billing",
        },
        { status: 402 },
      );
    }
    if (
      error instanceof Error &&
      (error.message.includes("额度不足") ||
        error.message.includes("余额不足"))
    ) {
      return Response.json(
        {
          error: error.message,
          code: ErrorCode.VALIDATION_ERROR,
          reason: "INSUFFICIENT_INVITE_CREDIT",
          redirect_to: "/organizer/billing",
        },
        { status: 402 },
      );
    }
    throw error;
  }
});
