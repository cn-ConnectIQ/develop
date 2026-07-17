import { InviteChannel, ParticipantInviteStatus, prisma } from "@connectiq/database";
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
import { buildInviteShortUrl } from "@/lib/invite/invite-url";
import { sendFixedParticipantInvites } from "@/lib/invite/send-fixed-invites";

const bodySchema = z.object({
  channel: z.enum(["SMS", "EMAIL"]),
  /** 对已邀请未激活者允许再发一封 */
  resend: z.boolean().optional(),
});

/** 账号管理员预览：返回该参会者最新邀请短链（真实链接，不做遮罩） */
export const GET = withErrorHandler(async (_request, context) => {
  const eventId = context?.params?.eventId;
  const participantId = context?.params?.participantId;
  if (!eventId || !participantId) {
    return createErrorResponse("参数缺失", ErrorCode.VALIDATION_ERROR, 400);
  }

  await requireEventAccess(eventId);

  const participant = await prisma.participant.findFirst({
    where: { id: participantId, eventId },
    select: { id: true, name: true, inviteStatus: true },
  });
  if (!participant) {
    return createErrorResponse("参会者不存在", ErrorCode.NOT_FOUND, 404);
  }

  const latest = await prisma.inviteRecord.findFirst({
    where: {
      participantId,
      campaign: { eventId },
      activationToken: { not: "" },
    },
    orderBy: { createdAt: "desc" },
    select: { activationToken: true, status: true, createdAt: true },
  });

  const previewLink = latest?.activationToken
    ? buildInviteShortUrl(latest.activationToken)
    : buildInviteShortUrl("{短码}");

  return createSuccessResponse({
    participant_id: participant.id,
    invite_status: participant.inviteStatus,
    preview_link: previewLink,
    has_existing_token: Boolean(latest?.activationToken),
  });
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
      inviteStatus: true,
    },
  });
  if (!participant) {
    return createErrorResponse("参会者不存在", ErrorCode.NOT_FOUND, 404);
  }

  if (
    !parsed.data.resend &&
    participant.inviteStatus !== ParticipantInviteStatus.NOT_INVITED
  ) {
    return createErrorResponse(
      participant.inviteStatus === ParticipantInviteStatus.ACTIVATED
        ? "该参会者已激活，如需再发请确认后再次提交"
        : "该参会者已邀请过，如需重发请确认后再次提交",
      ErrorCode.VALIDATION_ERROR,
      409,
    );
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
      allowResend: Boolean(parsed.data.resend),
      campaignName: `一键邀请·${participant.name}`,
    });

    if (result.queued <= 0) {
      const activatedResend =
        parsed.data.resend &&
        participant.inviteStatus === ParticipantInviteStatus.ACTIVATED;
      return createErrorResponse(
        activatedResend
          ? "未能加入发送队列（已激活重发未生效），请稍后重试或联系管理员"
          : "未能加入发送队列，请检查联系方式或邀请状态",
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
