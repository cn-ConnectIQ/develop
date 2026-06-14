import {
  InviteRecordStatus,
  ParticipantInviteStatus,
  UserAccountStatus,
  prisma,
} from "@connectiq/database";
import { ErrorCode } from "@connectiq/types";
import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api-auth";
import { completeActivationSchema } from "@/lib/invite/schemas";

export const POST = withErrorHandler(async (request) => {
  const body = await request.json();
  const parsed = completeActivationSchema.safeParse(body);

  if (!parsed.success) {
    return createErrorResponse(
      parsed.error.issues[0]?.message ?? "参数错误",
      ErrorCode.VALIDATION_ERROR,
      400,
    );
  }

  const { token, user_id: userId } = parsed.data;

  const record = await prisma.inviteRecord.findUnique({
    where: { activationToken: token },
    include: { participant: true },
  });

  if (!record) {
    return createErrorResponse("邀请 token 无效", ErrorCode.NOT_FOUND, 404);
  }

  if (record.tokenExpiresAt.getTime() < Date.now()) {
    return createErrorResponse("邀请链接已过期", ErrorCode.VALIDATION_ERROR, 410);
  }

  if (record.status === InviteRecordStatus.ACTIVATED) {
    return createSuccessResponse({ alreadyActivated: true, userId });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { profile: true },
  });

  if (!user) {
    return createErrorResponse("用户不存在", ErrorCode.NOT_FOUND, 404);
  }

  await prisma.$transaction(async (tx) => {
    await tx.inviteRecord.update({
      where: { id: record.id },
      data: {
        status: InviteRecordStatus.ACTIVATED,
        userId,
        activatedAt: new Date(),
        clickedAt: record.clickedAt ?? new Date(),
      },
    });

    await tx.participant.update({
      where: { id: record.participantId },
      data: { inviteStatus: ParticipantInviteStatus.ACTIVATED },
    });

    if (user.profile?.accountStatus === UserAccountStatus.SHADOW) {
      await tx.userProfile.update({
        where: { userId },
        data: { accountStatus: UserAccountStatus.ACTIVE },
      });
    } else if (!user.profile) {
      await tx.userProfile.create({
        data: {
          userId,
          accountStatus: UserAccountStatus.ACTIVE,
        },
      });
    }

    await tx.inviteCampaign.update({
      where: { id: record.campaignId },
      data: { activatedCount: { increment: 1 } },
    });
  });

  return createSuccessResponse({
    activated: true,
    userId,
    participantId: record.participantId,
    campaignId: record.campaignId,
  });
});
