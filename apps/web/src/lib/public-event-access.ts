import { EventStatus, prisma } from "@connectiq/database";
import { ErrorCode } from "@connectiq/types";
import { ApiError, requireEventAccessCheck } from "@/lib/api-auth";

/** 参会者/小程序可读的活动（非 DRAFT） */
export async function assertAttendeeReadableEvent(eventId: string) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, status: true },
  });
  if (!event) {
    throw new ApiError("活动不存在", ErrorCode.NOT_FOUND, 404);
  }
  if (event.status === EventStatus.DRAFT) {
    throw new ApiError("活动未开放", ErrorCode.NOT_FOUND, 404);
  }
  return event;
}

/**
 * 管理端 + 参会端共用列表：
 * - 主办方已登录且有活动权限 → 允许 DRAFT（筹备期配置互动）
 * - 否则走参会端规则（DRAFT → 活动未开放）
 */
export async function assertEventReadableForStaffOrAttendee(eventId: string) {
  const access = await requireEventAccessCheck(eventId);
  if (!("error" in access)) {
    return { id: access.event.id, status: access.event.status };
  }
  return assertAttendeeReadableEvent(eventId);
}
