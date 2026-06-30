import { ErrorCode } from "@connectiq/types";
import { prisma } from "@connectiq/database";
import {
  ApiError,
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api-auth";
import { listRecommendedBuyers } from "@/lib/exhibitor/dashboard-service";
import {
  requireExhibitorAdmin,
  resolveExhibitorOperatorUserId,
} from "@/lib/exhibitor/exhibitor-auth";
import { requireMobileAccountAdmin } from "@/lib/mobile-user-id";

async function resolveBoothForRecommendedBuyers(
  request: Request,
): Promise<{ boothId: string; eventId: string; exhibitorUserId: string | null }> {
  const { searchParams } = new URL(request.url);
  const queryEventId = searchParams.get("eventId")?.trim() || undefined;
  const queryBoothId = searchParams.get("boothId")?.trim() || undefined;

  if (queryBoothId) {
    const booth = await prisma.exhibitorBooth.findUnique({
      where: { id: queryBoothId },
      select: { id: true, eventId: true, operatorUserId: true, companyOrgId: true },
    });
    if (!booth) {
      throw new ApiError("展位不存在", ErrorCode.NOT_FOUND, 404);
    }
    if (queryEventId && booth.eventId !== queryEventId) {
      throw new ApiError("展位不属于该活动", ErrorCode.VALIDATION_ERROR, 400);
    }

    try {
      const { orgId } = await requireMobileAccountAdmin(request);
      const event = await prisma.event.findFirst({
        where: { id: booth.eventId, orgId },
        select: { id: true },
      });
      if (event) {
        const exhibitorUserId = await resolveExhibitorOperatorUserId(booth.id);
        return {
          boothId: booth.id,
          eventId: booth.eventId,
          exhibitorUserId,
        };
      }
    } catch {
      // fall through to exhibitor auth
    }

    const { booth: ctx } = await requireExhibitorAdmin(request);
    if (ctx.id !== queryBoothId) {
      throw new ApiError("无权查看该展位买家推荐", ErrorCode.FORBIDDEN, 403);
    }
    const exhibitorUserId = await resolveExhibitorOperatorUserId(ctx.id);
    return { boothId: ctx.id, eventId: ctx.eventId, exhibitorUserId };
  }

  const { booth } = await requireExhibitorAdmin(request);
  const exhibitorUserId = await resolveExhibitorOperatorUserId(booth.id);
  return { boothId: booth.id, eventId: booth.eventId, exhibitorUserId };
}

export const GET = withErrorHandler(async (request) => {
  const { boothId, eventId, exhibitorUserId } =
    await resolveBoothForRecommendedBuyers(request);

  const limit = Math.min(
    Math.max(Number(new URL(request.url).searchParams.get("limit") ?? "5"), 1),
    20,
  );

  const buyers = await listRecommendedBuyers(
    boothId,
    eventId,
    exhibitorUserId,
    limit,
  );

  const pendingCount = buyers.filter((b) => b.pending_contact).length;

  return createSuccessResponse({
    buyers,
    pending_contact_count: pendingCount,
  });
});
