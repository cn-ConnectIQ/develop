import { prisma } from "@connectiq/database";
import { ErrorCode } from "@connectiq/types";
import {
  createErrorResponse,
  createSuccessResponse,
  requireEventAccess,
  withErrorHandler,
} from "@/lib/api-auth";
import { createInviteCampaignSchema } from "@/lib/invite/schemas";
import { listCampaigns } from "@/lib/invite/service";

export const GET = withErrorHandler(async (_request, context) => {
  const eventId = context?.params?.eventId;
  if (!eventId) {
    return createErrorResponse("缺少活动 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  await requireEventAccess(eventId);
  const campaigns = await listCampaigns(eventId);

  return createSuccessResponse(campaigns, { total: campaigns.length });
});

export const POST = withErrorHandler(async (request, context) => {
  const eventId = context?.params?.eventId;
  if (!eventId) {
    return createErrorResponse("缺少活动 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  const { session } = await requireEventAccess(eventId);
  const body = await request.json();
  const parsed = createInviteCampaignSchema.safeParse(body);

  if (!parsed.success) {
    return createErrorResponse(
      parsed.error.issues[0]?.message ?? "参数错误",
      ErrorCode.VALIDATION_ERROR,
      400,
    );
  }

  const scheduledAt = parsed.data.scheduled_at
    ? new Date(parsed.data.scheduled_at)
    : null;

  const campaign = await prisma.inviteCampaign.create({
    data: {
      eventId,
      createdBy: session.user.id,
      name: parsed.data.name,
      channel: parsed.data.channel,
      templateId: parsed.data.template_id,
      subject: parsed.data.subject,
      customMessage: parsed.data.custom_message,
      targetFilter: parsed.data.target_filter,
      scheduledAt,
    },
    include: {
      creator: { select: { id: true, name: true } },
      _count: { select: { records: true } },
    },
  });

  return createSuccessResponse(campaign);
});
