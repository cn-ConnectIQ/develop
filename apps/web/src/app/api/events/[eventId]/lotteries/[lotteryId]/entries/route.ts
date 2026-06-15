import { prisma } from "@connectiq/database";
import { ErrorCode } from "@connectiq/types";
import {
  createErrorResponse,
  createSuccessResponse,
  requireEventAccess,
  withErrorHandler,
} from "@/lib/api-auth";
import { getLotteryOrThrow } from "@/lib/interaction/lottery-service";

/** 抽奖参与者列表（大屏滚动用） */
export const GET = withErrorHandler(async (_request, context) => {
  const eventId = context?.params?.eventId;
  const lotteryId = context?.params?.lotteryId;
  if (!eventId || !lotteryId) {
    return createErrorResponse("参数缺失", ErrorCode.VALIDATION_ERROR, 400);
  }

  await requireEventAccess(eventId);
  await getLotteryOrThrow(eventId, lotteryId);

  const entries = await prisma.lotteryEntry.findMany({
    where: { lotteryId },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          profile: { select: { company: true } },
        },
      },
    },
    orderBy: { enteredAt: "desc" },
    take: 500,
  });

  return createSuccessResponse(
    entries.map((e) => ({
      id: e.userId,
      name: e.user.name,
      company: e.user.profile?.company ?? null,
    })),
    { total: entries.length },
  );
});
