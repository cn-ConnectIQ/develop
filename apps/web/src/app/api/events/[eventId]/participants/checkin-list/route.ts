import { prisma } from "@connectiq/database";
import { ErrorCode } from "@connectiq/types";
import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api-auth";
import { requireMobileEventAccess } from "@/lib/mobile-user-id";

/** AD5 签到页 · 参会者名单搜索（姓名/公司模糊搜） */
export const GET = withErrorHandler(async (request, context) => {
  const eventId = context?.params?.eventId;
  if (!eventId) {
    return createErrorResponse("缺少活动 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  await requireMobileEventAccess(request, eventId);

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search")?.trim() || searchParams.get("q")?.trim();
  const limit = Math.min(Math.max(Number(searchParams.get("limit") ?? 30), 1), 100);

  const participants = await prisma.participant.findMany({
    where: {
      eventId,
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { company: { contains: search, mode: "insensitive" } },
              { phone: { contains: search } },
            ],
          }
        : {}),
    },
    include: {
      checkIns: {
        where: { eventId },
        take: 1,
        orderBy: { checkedInAt: "desc" },
        select: { checkedInAt: true },
      },
      registrations: {
        take: 1,
        orderBy: { registeredAt: "desc" },
        include: { ticketType: { select: { name: true } } },
      },
    },
    orderBy: [{ name: "asc" }, { id: "asc" }],
    take: limit,
  });

  return createSuccessResponse(
    participants.map((p) => ({
      id: p.id,
      name: p.name,
      company: p.company,
      job_title: p.jobTitle,
      phone: p.phone,
      badge_qr: p.badgeQr,
      ticket_type: p.registrations[0]?.ticketType?.name ?? null,
      checked_in: p.checkIns.length > 0,
      checked_in_at: p.checkIns[0]?.checkedInAt?.toISOString() ?? null,
    })),
    { total: participants.length },
  );
});
