import { prisma } from "@connectiq/database";
import { ApiError } from "@/lib/api-auth";
import { ErrorCode } from "@connectiq/types";

/**
 * 校验某活动新增采集点（Stamp）后是否会超出组织的每场活动上限（Organization.stampPointLimitPerEvent）。
 * 上限为 null 时不限制（默认所有非受限组织的行为）。
 * additionalCount 传"本次实际会新建的采集点数量"，不是传入配置里的总数——已存在、只是更新的点位不算新增。
 */
export async function assertStampPointQuota(
  eventId: string,
  additionalCount: number,
): Promise<void> {
  if (additionalCount <= 0) return;

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { orgId: true },
  });
  if (!event) return;

  const org = await prisma.organization.findUnique({
    where: { id: event.orgId },
    select: { stampPointLimitPerEvent: true },
  });
  const limit = org?.stampPointLimitPerEvent;
  if (limit == null) return;

  const currentCount = await prisma.stamp.count({
    where: { rally: { eventId } },
  });

  if (currentCount + additionalCount > limit) {
    throw new ApiError(
      `本活动采集点数量已达上限（${limit} 个，当前已有 ${currentCount} 个，本次还需新增 ${additionalCount} 个）`,
      ErrorCode.VALIDATION_ERROR,
      400,
    );
  }
}
