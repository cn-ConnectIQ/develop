import { ScanResult, prisma } from "@connectiq/database";
import { collectStampById } from "@/lib/stamp/stamp-collect-service";
import type { ScanHandlerContext, ScanHandlerOutcome } from "@/lib/scan/types";

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: string }).code === "P2002"
  );
}

export async function handleStampScan(
  ctx: ScanHandlerContext,
): Promise<ScanHandlerOutcome> {
  const stampId = ctx.actionRef?.trim();
  if (!stampId) {
    return {
      result: ScanResult.INVALID,
      message: "缺少打卡点 ID",
    };
  }

  const stamp = await prisma.stamp.findUnique({
    where: { id: stampId },
    include: {
      rally: { select: { eventId: true, requiredCount: true, id: true } },
    },
  });

  if (!stamp || stamp.rally.eventId !== ctx.eventId) {
    return {
      result: ScanResult.INVALID,
      message: "打卡点不存在",
    };
  }

  const existing = await prisma.userStamp.findUnique({
    where: {
      userId_stampId: { userId: ctx.attendeeUserId, stampId },
    },
  });
  if (existing) {
    const progress = await prisma.userStampProgress.findUnique({
      where: {
        userId_rallyId: { userId: ctx.attendeeUserId, rallyId: stamp.rallyId },
      },
    });
    const stamped = progress?.collectedCount ?? 0;
    const required = stamp.rally.requiredCount;
    return {
      result: ScanResult.DUPLICATE,
      message: "该参会者已在此打卡",
      actionDetail: {
        stampName: stamp.name,
        progress: `${stamped}/${required}`,
        justCompleted: false,
      },
    };
  }

  const beforeProgress = await prisma.userStampProgress.findUnique({
    where: {
      userId_rallyId: { userId: ctx.attendeeUserId, rallyId: stamp.rallyId },
    },
  });
  const wasCompleted = beforeProgress?.isCompleted ?? false;

  try {
    const result = await collectStampById(stampId, ctx.attendeeUserId);
    const justCompleted = result.completed && !wasCompleted;

    return {
      result: ScanResult.SUCCESS,
      message: justCompleted
        ? "🎉 TA 集满了！提醒 TA 去兑换"
        : `打卡成功 · ${result.stamp_name}`,
      actionDetail: {
        stampName: result.stamp_name,
        progress: `${result.stamped_count}/${result.required_count}`,
        justCompleted,
      },
    };
  } catch (err) {
    if (isUniqueViolation(err)) {
      const progress = await prisma.userStampProgress.findUnique({
        where: {
          userId_rallyId: {
            userId: ctx.attendeeUserId,
            rallyId: stamp.rallyId,
          },
        },
      });
      const stamped = progress?.collectedCount ?? 0;
      return {
        result: ScanResult.DUPLICATE,
        message: "该参会者已在此打卡",
        actionDetail: {
          stampName: stamp.name,
          progress: `${stamped}/${stamp.rally.requiredCount}`,
          justCompleted: false,
        },
      };
    }
    throw err;
  }
}
