import { prisma } from "@connectiq/database";
import { ErrorCode, UserRole } from "@connectiq/types";
import {
  ApiError,
  createErrorResponse,
  createSuccessResponse,
  requireEventAccessCheck,
  withErrorHandler,
  type AuthSession,
} from "@/lib/api-auth";
import { guardEventFeature } from "@/lib/event-feature-flag-guard";
import { requireLotteryManageAccess } from "@/lib/interaction/lottery-service";
import { createBoothProbabilityLotterySchema } from "@/lib/lottery/booth-probability-lottery-schemas";
import { createOrganizerProbabilityLottery } from "@/lib/lottery/organizer-participant-lottery-service";
import { requireMobileEventAccess } from "@/lib/mobile-user-id";

async function resolveOrganizerSession(
  request: Request,
  eventId: string,
): Promise<AuthSession> {
  const webAccess = await requireEventAccessCheck(eventId);
  if (!("error" in webAccess)) {
    await requireLotteryManageAccess(webAccess.session, eventId);
    return webAccess.session;
  }

  // 小程序 Bearer：账号管理员已通过 requireMobileEventAccess 校验
  const { userId, orgId } = await requireMobileEventAccess(request, eventId);
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      userType: true,
    },
  });
  if (!user) {
    throw new ApiError("用户不存在", ErrorCode.NOT_FOUND, 404);
  }

  return {
    user: {
      id: user.id,
      name: user.name ?? "",
      email: user.email ?? "",
      role: UserRole.ORGANIZER,
      userType: user.userType,
      activeOrgId: orgId,
    },
    expires: new Date(Date.now() + 86_400_000).toISOString(),
  } as AuthSession;
}

/** 管理端 · 主办方概率抽奖（AUTO_PROBABILITY）；支持 Web Session 与小程序 Bearer */
export const POST = withErrorHandler(async (request, context) => {
  const eventId = context?.params?.eventId;
  if (!eventId) {
    return createErrorResponse("缺少活动 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  const session = await resolveOrganizerSession(request, eventId);

  const disabled = await guardEventFeature(eventId, "lottery");
  if (disabled) return disabled;

  const body = await request.json().catch(() => ({}));
  const parsed = createBoothProbabilityLotterySchema.safeParse(body);
  if (!parsed.success) {
    return createErrorResponse(
      parsed.error.issues[0]?.message ?? "参数错误",
      ErrorCode.VALIDATION_ERROR,
      400,
    );
  }

  const result = await createOrganizerProbabilityLottery(
    eventId,
    session,
    parsed.data,
  );
  return createSuccessResponse(result);
});
