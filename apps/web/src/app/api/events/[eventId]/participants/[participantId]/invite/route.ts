import { InviteChannel, prisma } from "@connectiq/database";
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
import { ensureParticipantInvitePreviewToken } from "@/lib/invite/preview-token";
import { sendFixedParticipantInvites } from "@/lib/invite/send-fixed-invites";

const bodySchema = z.object({
  channel: z.enum(["SMS", "EMAIL"]),
  /** @deprecated 单人邀请已允许任意次数重发，保留字段兼容旧前端 */
  resend: z.boolean().optional(),
});

/** 账号管理员预览：返回真实短链；若尚未签发则先预生成（不发送） */
export const GET = withErrorHandler(async (_request, context) => {
  const eventId = context?.params?.eventId;
  const participantId = context?.params?.participantId;
  if (!eventId || !participantId) {
    return createErrorResponse("参数缺失", ErrorCode.VALIDATION_ERROR, 400);
  }

  const { session } = await requireEventAccess(eventId);

  const participant = await prisma.participant.findFirst({
    where: { id: participantId, eventId },
    select: { id: true, name: true, inviteStatus: true },
  });
  if (!participant) {
    return createErrorResponse("参会者不存在", ErrorCode.NOT_FOUND, 404);
  }

  try {
    const preview = await ensureParticipantInvitePreviewToken({
      eventId,
      participantId,
      createdBy: session.user.id,
    });

    return createSuccessResponse({
      participant_id: participant.id,
      invite_status: participant.inviteStatus,
      preview_link: preview.previewLink,
      activation_token: preview.activationToken,
      has_existing_token: true,
      preview_created: preview.created,
    });
  } catch (err) {
    if (err instanceof Error && err.message === "PARTICIPANT_NOT_FOUND") {
      return createErrorResponse("参会者不存在", ErrorCode.NOT_FOUND, 404);
    }
    throw err;
  }
});

export const POST = withErrorHandler(async (request, context) => {
  const eventId = context?.params?.eventId;
  const participantId = context?.params?.participantId;
  if (!eventId || !participantId) {
    return createErrorResponse("参数缺失", ErrorCode.VALIDATION_ERROR, 400);
  }

  const { session } = await requireEventAccess(eventId);
  const disabled = await guardEventFeature(eventId, "inviteSystem");
  if (disabled) return disabled;

  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return createErrorResponse(
      parsed.error.issues[0]?.message ?? "参数错误",
      ErrorCode.VALIDATION_ERROR,
      400,
    );
  }

  const channel =
    parsed.data.channel === "SMS" ? InviteChannel.SMS : InviteChannel.EMAIL;

  const participant = await prisma.participant.findFirst({
    where: { id: participantId, eventId },
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
    },
  });
  if (!participant) {
    return createErrorResponse("参会者不存在", ErrorCode.NOT_FOUND, 404);
  }

  if (channel === InviteChannel.SMS && !participant.phone?.trim()) {
    return createErrorResponse(
      "该参会者没有手机号，请改用邮件或先补全联系方式",
      ErrorCode.VALIDATION_ERROR,
      400,
    );
  }
  if (channel === InviteChannel.EMAIL && !participant.email?.trim()) {
    return createErrorResponse(
      "该参会者没有邮箱，请改用短信或先补全联系方式",
      ErrorCode.VALIDATION_ERROR,
      400,
    );
  }

  try {
    const result = await sendFixedParticipantInvites({
      eventId,
      participantIds: [participantId],
      channel,
      createdBy: session.user.id,
      // 单人邀请：短信/邮件可各发、可多次发，不按邀请状态拦截
      allowResend: true,
      campaignName: `一键邀请·${participant.name}`,
    });

    if (result.queued <= 0) {
      return createErrorResponse(
        "未能加入发送队列，请检查联系方式后重试",
        ErrorCode.VALIDATION_ERROR,
        400,
      );
    }

    return createSuccessResponse({
      campaign_id: result.campaignId,
      queued: result.queued,
      skipped: result.skipped,
      channel,
      participant_id: participantId,
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
