import { prisma, ParticipantInviteStatus, ParticipantRole, type Prisma } from "@connectiq/database";
import { ErrorCode } from "@connectiq/types";
import { z } from "zod";
import {
  createErrorResponse,
  createSuccessResponse,
  requireEventAccess,
  withErrorHandler,
} from "@/lib/api-auth";
import { generateBadgeQr } from "@/lib/participants";

function serializeParticipant(
  p: Awaited<ReturnType<typeof prisma.participant.findMany>>[number] & {
    checkIns: { checkedInAt: Date }[];
    registrations: Array<{
      ticketTypeId: string | null;
      ticketType: { id: string; name: string } | null;
    }>;
    _count: { leads: number };
  },
) {
  const ticketType = p.registrations[0]?.ticketType?.name ?? null;
  const ticketTypeId = p.registrations[0]?.ticketTypeId ?? null;
  const isVip = ticketType?.toUpperCase().includes("VIP") ?? false;
  const isSpeaker = p.role === ParticipantRole.SPEAKER;

  return {
    id: p.id,
    name: p.name,
    email: p.email,
    phone: p.phone,
    company: p.company,
    jobTitle: p.jobTitle,
    role: p.role,
    badgeQr: p.badgeQr,
    createdAt: p.createdAt.toISOString(),
    ticketType,
    ticketTypeId,
    checkedInAt: p.checkIns[0]?.checkedInAt?.toISOString() ?? null,
    connectionCount: p._count.leads,
    isVip,
    isSpeaker,
    inviteStatus: p.inviteStatus,
  };
}

function buildWhere(
  eventId: string,
  search: string | undefined,
  status: string | null,
  role: string | null,
  inviteStatus: string | null,
): Prisma.ParticipantWhereInput {
  const where: Prisma.ParticipantWhereInput = { eventId };

  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { company: { contains: search, mode: "insensitive" } },
      { phone: { contains: search } },
      { email: { contains: search, mode: "insensitive" } },
      { jobTitle: { contains: search, mode: "insensitive" } },
    ];
  }

  if (status === "checked_in") {
    where.checkIns = { some: { eventId } };
  } else if (status === "pending") {
    where.checkIns = { none: { eventId } };
  }

  if (role === "speaker") {
    where.role = ParticipantRole.SPEAKER;
  } else if (role === "vip") {
    where.registrations = {
      some: {
        ticketType: { name: { contains: "VIP", mode: "insensitive" } },
      },
    };
  }

  if (inviteStatus === "not_invited") {
    where.inviteStatus = ParticipantInviteStatus.NOT_INVITED;
  }

  return where;
}

export const GET = withErrorHandler(async (request, context) => {
  const eventId = context?.params?.eventId;
  if (!eventId) {
    return createErrorResponse("缺少活动 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  await requireEventAccess(eventId);

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search")?.trim() || undefined;
  const status = searchParams.get("status");
  const role = searchParams.get("role");
  const inviteStatus = searchParams.get("invite_status");
  const cursor = searchParams.get("cursor");
  const limit = Math.min(Math.max(Number(searchParams.get("limit") ?? 20), 1), 100);

  const where = buildWhere(eventId, search, status, role, inviteStatus);

  const participants = await prisma.participant.findMany({
    where,
    include: {
      checkIns: { where: { eventId }, take: 1, orderBy: { checkedInAt: "desc" } },
      registrations: {
        take: 1,
        orderBy: { registeredAt: "desc" },
        include: { ticketType: { select: { id: true, name: true } } },
      },
      _count: { select: { leads: true } },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasNext = participants.length > limit;
  const items = hasNext ? participants.slice(0, limit) : participants;

  const [total, checkedIn, vipCount, activated, invited, notInvited, ticketTypes] =
    await Promise.all([
    prisma.participant.count({ where: { eventId } }),
    prisma.checkIn.count({ where: { eventId } }),
    prisma.participantRegistration.count({
      where: {
        participant: { eventId },
        ticketType: { name: { contains: "VIP", mode: "insensitive" } },
      },
    }),
    prisma.participant.count({
      where: { eventId, inviteStatus: ParticipantInviteStatus.ACTIVATED },
    }),
    prisma.participant.count({
      where: {
        eventId,
        inviteStatus: {
          in: [
            ParticipantInviteStatus.INVITED,
            ParticipantInviteStatus.CLICKED,
            ParticipantInviteStatus.ACTIVATED,
          ],
        },
      },
    }),
    prisma.participant.count({
      where: { eventId, inviteStatus: ParticipantInviteStatus.NOT_INVITED },
    }),
    prisma.ticketType.findMany({
      where: { eventId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const activationRate =
    invited > 0 ? Math.round((activated / invited) * 1000) / 10 : 0;

  return createSuccessResponse(items.map(serializeParticipant), {
    total,
    cursor: hasNext ? items[items.length - 1]?.id : null,
    hasNext,
    checkedIn,
    pending: total - checkedIn,
    vip: vipCount,
    activated,
    invited,
    notInvited,
    activationRate,
    ticketTypes,
  });
});

const createSchema = z.object({
  name: z.string().min(1, "请输入姓名"),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  company: z.string().optional(),
  jobTitle: z.string().optional(),
  role: z.nativeEnum(ParticipantRole).optional(),
  ticketTypeId: z.string().optional(),
});

export const POST = withErrorHandler(async (request, context) => {
  const eventId = context?.params?.eventId;
  if (!eventId) {
    return createErrorResponse("缺少活动 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  await requireEventAccess(eventId);

  const body = await request.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return createErrorResponse(
      parsed.error.issues[0]?.message ?? "参数错误",
      ErrorCode.VALIDATION_ERROR,
      400,
    );
  }

  if (parsed.data.phone) {
    const dup = await prisma.participant.findFirst({
      where: { eventId, phone: parsed.data.phone },
    });
    if (dup) {
      return createErrorResponse("该手机号已存在", ErrorCode.VALIDATION_ERROR, 409);
    }
  }

  const participant = await prisma.participant.create({
    data: {
      eventId,
      name: parsed.data.name,
      email: parsed.data.email || null,
      phone: parsed.data.phone || null,
      company: parsed.data.company || null,
      jobTitle: parsed.data.jobTitle || null,
      role: parsed.data.role ?? ParticipantRole.ATTENDEE,
      badgeQr: generateBadgeQr(eventId),
      ...(parsed.data.ticketTypeId
        ? {
            registrations: {
              create: {
                ticketTypeId: parsed.data.ticketTypeId,
                status: "CONFIRMED",
              },
            },
          }
        : {}),
    },
    include: {
      checkIns: { where: { eventId }, take: 1 },
      registrations: {
        take: 1,
        include: { ticketType: { select: { id: true, name: true } } },
      },
      _count: { select: { leads: true } },
    },
  });

  return createSuccessResponse(serializeParticipant(participant));
});
