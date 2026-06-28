import { EventStatus, prisma } from "@connectiq/database";
import { ErrorCode } from "@connectiq/types";
import { ApiError } from "@/lib/api-auth";

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
