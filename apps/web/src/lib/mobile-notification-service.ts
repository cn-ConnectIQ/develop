import { prisma } from "@connectiq/database";
import { ErrorCode } from "@connectiq/types";
import { ApiError } from "@/lib/api-auth";

export type MobileNotificationRouteTarget =
  | "EXCHANGE_CONFIRM"
  | "EXCHANGE_SUCCESS"
  | "BOOTH_DETAIL"
  | "LOTTERY_RESULT"
  | "AI_REC"
  | "BROADCAST"
  | "MEETING_REQUEST";

export type ApiMobileNotification = {
  id: string;
  type: string;
  title: string;
  body: string;
  createdAt: string;
  isRead: boolean;
  routeTarget: MobileNotificationRouteTarget;
  routePayload: Record<string, string>;
};

function stripRouteComment(body: string): string {
  return body.replace(/\n<!--[^>]+-->/g, "").trim();
}

function parseRoute(
  title: string,
  body: string,
): { routeTarget: MobileNotificationRouteTarget; routePayload: Record<string, string> } {
  const commentMatch = body.match(/<!--(\w+):([^>]+)-->/);
  if (commentMatch) {
    const [, kind, id] = commentMatch;
    if (kind === "exchange_request") {
      return { routeTarget: "EXCHANGE_CONFIRM", routePayload: { requestId: id } };
    }
    if (kind === "exchange_accepted") {
      return { routeTarget: "EXCHANGE_SUCCESS", routePayload: { requestId: id } };
    }
    if (kind === "buyer") {
      return { routeTarget: "BOOTH_DETAIL", routePayload: { userId: id } };
    }
    if (kind === "lottery") {
      return { routeTarget: "LOTTERY_RESULT", routePayload: { lotteryId: id } };
    }
    if (kind === "meeting") {
      return { routeTarget: "MEETING_REQUEST", routePayload: { meetingId: id } };
    }
    if (kind === "ai_rec") {
      return { routeTarget: "AI_REC", routePayload: { userId: id } };
    }
  }

  if (title.includes("抽奖") || body.includes("中奖")) {
    return { routeTarget: "LOTTERY_RESULT", routePayload: {} };
  }
  if (title.includes("会面") || title.includes("预约")) {
    return { routeTarget: "MEETING_REQUEST", routePayload: {} };
  }
  if (title.includes("匹配") || title.includes("推荐") || title.includes("引荐")) {
    return { routeTarget: "AI_REC", routePayload: {} };
  }
  if (title.includes("交换微信") || body.includes("交换微信")) {
    return { routeTarget: "EXCHANGE_CONFIRM", routePayload: {} };
  }

  return { routeTarget: "BROADCAST", routePayload: {} };
}

export async function countUnreadNotifications(userId: string): Promise<number> {
  return prisma.notification.count({
    where: { userId, readAt: null },
  });
}

export async function listMobileNotifications(
  userId: string,
): Promise<ApiMobileNotification[]> {
  const rows = await prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return rows.map((row) => {
    const { routeTarget, routePayload } = parseRoute(row.title, row.body);
    return {
      id: row.id,
      type: routeTarget.toLowerCase(),
      title: row.title,
      body: stripRouteComment(row.body),
      createdAt: row.createdAt.toISOString(),
      isRead: Boolean(row.readAt),
      routeTarget,
      routePayload,
    };
  });
}

export async function markNotificationRead(
  userId: string,
  notificationId: string,
): Promise<void> {
  const row = await prisma.notification.findFirst({
    where: { id: notificationId, userId },
    select: { id: true },
  });
  if (!row) {
    throw new ApiError("通知不存在", ErrorCode.NOT_FOUND, 404);
  }

  await prisma.notification.update({
    where: { id: notificationId },
    data: { readAt: new Date() },
  });
}

export async function markAllNotificationsRead(userId: string): Promise<number> {
  const result = await prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
  return result.count;
}
