import { prisma } from "@connectiq/database";
import {
  createSuccessResponse,
  requireEventAccess,
  withErrorHandler,
} from "@/lib/api-auth";

export const GET = withErrorHandler(async (_request, context) => {
  const eventId = context?.params?.eventId;
  if (!eventId) throw new Error("缺少活动 ID");
  await requireEventAccess(eventId);
  const ticketTypes = await prisma.ticketType.findMany({
    where: { eventId },
    select: { id: true, name: true, price: true, quota: true },
    orderBy: { createdAt: "asc" },
  });
  return createSuccessResponse({ ticketTypes });
});
