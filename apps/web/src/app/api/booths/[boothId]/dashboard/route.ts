import { prisma } from "@connectiq/database";
import { ErrorCode } from "@connectiq/types";
import {
  createErrorResponse,
  createSuccessResponse,
  requireBoothAccess,
  withErrorHandler,
} from "@/lib/api-auth";
import { listHighIntentBuyersForBooth } from "@/lib/signals";

export const GET = withErrorHandler(async (_request, context) => {
  const boothId = context?.params?.boothId;
  if (!boothId) {
    return createErrorResponse("缺少展位 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  await requireBoothAccess(boothId);

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const booth = await prisma.exhibitorBooth.findUnique({
    where: { id: boothId },
    include: {
      event: { select: { id: true, name: true } },
      leads: {
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          createdAt: true,
          status: true,
          notes: true,
          crmSyncStatus: true,
          crmSyncError: true,
          participant: { select: { name: true, company: true } },
          intentTags: { include: { intentTag: true } },
        },
      },
    },
  });

  if (!booth) {
    return createErrorResponse("展位不存在", ErrorCode.NOT_FOUND, 404);
  }

  const [todayVisitors, gradeA, gradeBC, crmSynced, highIntentBuyers] =
    await Promise.all([
    prisma.lead.count({
      where: { boothId, createdAt: { gte: todayStart } },
    }),
    prisma.lead.count({
      where: {
        boothId,
        intentTags: {
          some: {
            intentTag: {
              OR: [
                { label: { contains: "采购" } },
                { label: { contains: "投资" } },
              ],
            },
          },
        },
      },
    }),
    prisma.lead.count({
      where: {
        boothId,
        intentTags: {
          some: {
            intentTag: {
              NOT: {
                OR: [
                  { label: { contains: "采购" } },
                  { label: { contains: "投资" } },
                ],
              },
            },
          },
        },
      },
    }),
    prisma.lead.count({
      where: { boothId, crmSyncStatus: "SYNCED" },
    }),
    listHighIntentBuyersForBooth(boothId, booth.event.id),
  ]);

  return createSuccessResponse({
    code: booth.code,
    name: booth.name,
    event: booth.event,
    stats: {
      todayVisitors,
      gradeA,
      gradeBC,
      crmSynced,
    },
    highIntentBuyers,
    leads: booth.leads,
  });
});
