import { prisma } from "@connectiq/database";
import { ErrorCode } from "@connectiq/types";
import {
  createErrorResponse,
  createSuccessResponse,
  requireAuth,
  withErrorHandler,
} from "@/lib/api-auth";

export const GET = withErrorHandler(async (request, context) => {
  await requireAuth(request);

  const userId = context?.params?.userId;
  if (!userId) {
    return createErrorResponse("缺少用户 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      phone: true,
      profile: {
        select: {
          company: true,
          industry: true,
          valueProposition: true,
        },
      },
    },
  });

  if (!user) {
    return createErrorResponse("用户不存在", ErrorCode.NOT_FOUND, 404);
  }

  return createSuccessResponse({
    id: user.id,
    name: user.name,
    phone: user.phone ?? undefined,
    company: user.profile?.company ?? undefined,
    industry: user.profile?.industry ?? undefined,
    value_proposition: user.profile?.valueProposition ?? undefined,
  });
});
