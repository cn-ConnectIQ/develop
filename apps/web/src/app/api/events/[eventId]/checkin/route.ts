import { ErrorCode } from "@connectiq/types";
import { prisma, SignalType } from "@connectiq/database";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  ApiError,
  createErrorResponse,
  createSuccessResponse,
  requireEventAccess,
  withErrorHandler,
} from "@/lib/api-auth";
import { performStaffBadgeCheckin } from "@/lib/checkin-staff";
import { buildHourlyBuckets, calcCheckinRate } from "@/lib/checkin";
import { ensureParticipantForUser } from "@/lib/interaction/participant-user";
import {
  requireMobileAccountAdmin,
  resolveMobileUserId,
} from "@/lib/mobile-user-id";
import { recordSignal } from "@/lib/signals";
import { stampBoothForActiveRallies } from "@/lib/stamp-rally-service";

const boothScanSchema = z.object({
  booth_id: z.string().min(1),
});

const staffCheckinSchema = z.object({
  badge_qr: z.string().min(1),
});


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

/** 参会者扫展位码签到 / 工作人员扫胸牌签到 */
export const POST = withErrorHandler(async (request, context) => {
  const eventId = context?.params?.eventId;
  if (!eventId) {
    return createErrorResponse("缺少活动 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  const body = await request.json().catch(() => ({}));

  const staffParsed = staffCheckinSchema.safeParse(body);
  if (staffParsed.success) {
    try {
      await requireEventAccess(request, eventId);
    } catch {
      await requireMobileAccountAdmin(request);
    }

    try {
      const result = await performStaffBadgeCheckin(
        eventId,
        staffParsed.data.badge_qr,
      );

      if (result.already_checked_in) {
        return NextResponse.json(
          {
            success: false,
            error: "该参会者已签到",
            code: "ALREADY_CHECKED_IN",
            participant: result.participant,
            checked_in_at: result.checked_in_at,
            data: {
              participant: result.participant,
              checked_in_at: result.checked_in_at,
            },
          },
          { status: 409 },
        );
      }

      return createSuccessResponse({
        participant: result.participant,
        checked_in_at: result.checked_in_at,
        name: result.participant.name,
        ticket_type: result.participant.ticket_type,
      });
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        return createErrorResponse(err.message, ErrorCode.NOT_FOUND, 404);
      }
      throw err;
    }
  }

  const boothParsed = boothScanSchema.safeParse(body);
  if (!boothParsed.success) {
    return createErrorResponse("参数错误", ErrorCode.VALIDATION_ERROR, 400);
  }

  const userId = await resolveMobileUserId(request);

  const booth = await prisma.exhibitorBooth.findFirst({
    where: { id: boothParsed.data.booth_id, eventId },
    select: { id: true, name: true, code: true },
  });
  if (!booth) {
    return createErrorResponse("展位不存在", ErrorCode.NOT_FOUND, 404);
  }

  await ensureParticipantForUser(eventId, userId);

  recordSignal(userId, eventId, SignalType.BOOTH_SCAN, booth.id, "BOOTH", {
    booth_name: booth.name,
    booth_code: booth.code,
  });

  void stampBoothForActiveRallies(eventId, userId, booth.id).catch(() => {
    // 集章失败不影响扫码
  });

  return createSuccessResponse({
    scanned: true,
    booth: { id: booth.id, name: booth.name, code: booth.code },
  });
});
