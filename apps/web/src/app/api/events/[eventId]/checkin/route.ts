import { ErrorCode } from "@connectiq/types";
import { prisma, SignalType } from "@connectiq/database";
import { z } from "zod";
import {
  ApiError,
  createErrorResponse,
  createSuccessResponse,
  requireAuth,
  requireEventAccess,
  withErrorHandler,
} from "@/lib/api-auth";
import { buildHourlyBuckets, calcCheckinRate } from "@/lib/checkin";
import { ensureParticipantForUser } from "@/lib/interaction/participant-user";
import { recordSignal } from "@/lib/signals";
import { stampBoothForActiveRallies } from "@/lib/stamp-rally-service";

const postSchema = z.object({
  booth_id: z.string().cuid(),
});

async function resolveUserId(request: Request): Promise<string> {
  try {
    const { user } = await requireAuth(request);
    return user.id;
  } catch (err) {
    if (!(err instanceof ApiError) || err.status !== 401) throw err;
  }

  const auth = request.headers.get("authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  if (token === "dev-mock-token") {
    const demo = await prisma.user.findFirst({
      where: { phone: "13800138000" },
      select: { id: true },
    });
    if (demo) return demo.id;
  }

  throw new ApiError("未登录", ErrorCode.UNAUTHORIZED, 401);
}

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

/** 参会者扫展位码签到 */
export const POST = withErrorHandler(async (request, context) => {
  const eventId = context?.params?.eventId;
  if (!eventId) {
    return createErrorResponse("缺少活动 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  const userId = await resolveUserId(request);
  const body = await request.json().catch(() => ({}));
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return createErrorResponse("参数错误", ErrorCode.VALIDATION_ERROR, 400);
  }

  const booth = await prisma.exhibitorBooth.findFirst({
    where: { id: parsed.data.booth_id, eventId },
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
