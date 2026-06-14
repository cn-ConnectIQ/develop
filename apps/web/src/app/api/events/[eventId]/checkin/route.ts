import { prisma } from "@connectiq/database";
import { ErrorCode } from "@connectiq/types";
import {
  createErrorResponse,
  createSuccessResponse,
  requireEventAccess,
  withErrorHandler,
} from "@/lib/api-auth";
import { buildHourlyBuckets, calcCheckinRate } from "@/lib/checkin";

export const GET = withErrorHandler(async (_request, context) => {
  const eventId = context?.params?.eventId;
  if (!eventId) {
    return createErrorResponse("缺少活动 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  await requireEventAccess(eventId);

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, name: true, startDate: true },
  });
  if (!event) {
    return createErrorResponse("活动不存在", ErrorCode.NOT_FOUND, 404);
  }

  const [
    participantCount,
    checkIns,
    recentCheckIns,
    vipRegistrations,
    speakerTotal,
    speakerCheckedIn,
    vipParticipants,
    todayNew,
  ] = await Promise.all([
    prisma.participant.count({ where: { eventId } }),
    prisma.checkIn.findMany({
      where: { eventId },
      select: { checkedInAt: true, participantId: true },
    }),
    prisma.checkIn.findMany({
      where: { eventId },
      orderBy: { checkedInAt: "desc" },
      take: 20,
      include: {
        participant: {
          include: {
            registrations: {
              take: 1,
              orderBy: { registeredAt: "desc" },
              include: { ticketType: { select: { name: true } } },
            },
          },
        },
      },
    }),
    prisma.participantRegistration.count({
      where: {
        participant: { eventId },
        ticketType: { name: { contains: "VIP", mode: "insensitive" } },
      },
    }),
    prisma.participant.count({
      where: { eventId, role: "SPEAKER" },
    }),
    prisma.checkIn.count({
      where: { eventId, participant: { role: "SPEAKER" } },
    }),
    prisma.participant.findMany({
      where: {
        eventId,
        registrations: {
          some: {
            ticketType: { name: { contains: "VIP", mode: "insensitive" } },
          },
        },
      },
      select: {
        id: true,
        name: true,
        company: true,
        registrations: {
          take: 1,
          orderBy: { registeredAt: "desc" },
          include: { ticketType: { select: { name: true } } },
        },
        checkIns: {
          where: { eventId },
          take: 1,
          orderBy: { checkedInAt: "desc" },
          select: { checkedInAt: true },
        },
      },
      orderBy: { name: "asc" },
    }),
    prisma.participant.count({
      where: {
        eventId,
        createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
      },
    }),
  ]);

  const checkedInIds = new Set(checkIns.map((c) => c.participantId));
  const vipCheckedIn = await prisma.participantRegistration.count({
    where: {
      participant: { eventId, id: { in: [...checkedInIds] } },
      ticketType: { name: { contains: "VIP", mode: "insensitive" } },
    },
  });

  const checkedIn = checkIns.length;
  const rate = calcCheckinRate(checkedIn, participantCount);

  const startHour = event.startDate?.getHours() ?? 9;

  return createSuccessResponse({
    event: { id: event.id, name: event.name },
    stats: {
      checkedIn,
      total: participantCount,
      rate,
      vipCheckedIn,
      vipTotal: vipRegistrations,
      speakerCheckedIn,
      speakerTotal,
      todayNew,
    },
    hourly: buildHourlyBuckets(checkIns, Math.max(8, startHour - 1), 20),
    recent: recentCheckIns.map((c) => {
      const ticketType =
        c.participant.registrations[0]?.ticketType?.name ?? "普通票";
      return {
        id: c.id,
        checkedInAt: c.checkedInAt,
        name: c.participant.name,
        company: c.participant.company,
        ticketType,
        isVip: ticketType.toUpperCase().includes("VIP"),
      };
    }),
    vipList: vipParticipants.map((p) => ({
      id: p.id,
      name: p.name,
      company: p.company,
      ticketType: p.registrations[0]?.ticketType?.name ?? "VIP",
      checkedIn: p.checkIns.length > 0,
      checkedInAt: p.checkIns[0]?.checkedInAt ?? null,
    })),
  });
});
