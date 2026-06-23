import { prisma } from "@connectiq/database";
import { ErrorCode } from "@connectiq/types";
import {
  createErrorResponse,
  createSuccessResponse,
  requireEventAccess,
  withErrorHandler,
} from "@/lib/api-auth";

export const POST = withErrorHandler(async (_request, context) => {
  const eventId = context?.params?.eventId;
  if (!eventId) {
    return createErrorResponse("缺少活动 ID", ErrorCode.VALIDATION_ERROR, 400);
  }
  await requireEventAccess(eventId);

  const external = await prisma.externalSync.findFirst({
    where: { eventId },
  });

  const now = new Date().toISOString();
  await prisma.eventSetting.upsert({
    where: { eventId_key: { eventId, key: "baige_last_sync_at" } },
    create: { eventId, key: "baige_last_sync_at", value: now },
    update: { value: now },
  });

  return createSuccessResponse({
    synced_at: now,
    provider: external?.provider ?? "baige",
    message: external
      ? "已触发百格/MarketUP 同步时间戳更新"
      : "已记录同步时间（尚未配置外部数据源，请在集成页完成配置）",
  });
});
