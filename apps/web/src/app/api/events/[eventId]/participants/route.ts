import {
  ParticipantInviteStatus,
  ParticipantRole,
  ParticipantSource,
  SystemRole,
  prisma,
  type Prisma,
} from "@connectiq/database";
import { ErrorCode } from "@connectiq/types";
import { z } from "zod";
import {
  createErrorResponse,
  createSuccessResponse,
  requireEventAccess,
  withErrorHandler,
} from "@/lib/api-auth";
import { mergeParticipantByPhone } from "@/lib/participant-merge";
import { serializeParticipantRow } from "@/lib/participant-serialize";
import { maybeAutoInviteNewParticipants } from "@/lib/invite/send-fixed-invites";
import { requireEventAccessMobileOrWeb } from "@/lib/mobile-event-access";
import {
  isSpeakerTagged,
  isVipTagged,
  normalizeParticipantTags,
  participantHasTag,
} from "@/lib/participant-tags";
import { generateBadgeQr } from "@/lib/participants";

function buildWhere(
  eventId: string,
  search: string | undefined,
  status: string | null,
  tag: string | null,
  tagsFilter: string[] | null,
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

  if (tagsFilter?.length) {
    where.tags = { hasSome: tagsFilter };
  } else if (tag) {
    where.tags = { has: tag };
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

  await requireEventAccessMobileOrWeb(request, eventId);

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search")?.trim() || undefined;
  const status = searchParams.get("status");
  const tagsParam = searchParams.get("tags");
  const tagsFilter = tagsParam
    ? tagsParam
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
    : null;
  const tag =
    tagsFilter?.length
      ? null
      : searchParams.get("tag") ??
        (searchParams.get("role") === "vip"
          ? "VIP"
          : searchParams.get("role") === "speaker"
            ? "Speaker"
            : null);
  const inviteStatus = searchParams.get("invite_status");
  const cursor = searchParams.get("cursor");
  const limit = Math.min(Math.max(Number(searchParams.get("limit") ?? 20), 1), 100);

  const where = buildWhere(
    eventId,
    search,
    status,
    tag,
    tagsFilter,
    inviteStatus,
  );

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

  const allForStats = await prisma.participant.findMany({
    where: { eventId },
    select: { id: true, tags: true, role: true, inviteStatus: true },
  });

  const vip = allForStats.filter(
    (p) => isVipTagged(p.tags) || participantHasTag(p.tags, "VIP"),
  ).length;
  const speaker = allForStats.filter(
    (p) => isSpeakerTagged(p.tags) || p.role === ParticipantRole.SPEAKER,
  ).length;

  const [total, checkedIn, activated, invited, notInvited, ticketTypes] =
    await Promise.all([
      prisma.participant.count({ where: { eventId } }),
      prisma.checkIn.count({ where: { eventId } }),
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

  return createSuccessResponse(
    items.map((p) => serializeParticipantRow(p, eventId)),
    {
      total,
      cursor: hasNext ? items[items.length - 1]?.id : null,
      hasNext,
      checkedIn,
      pending: total - checkedIn,
      vip,
      speaker,
      activated,
      invited,
      notInvited,
      activationRate,
      ticketTypes,
    },
  );
});

const createSchema = z.object({
  name: z.string().min(1, "请输入姓名"),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  company: z.string().optional(),
  jobTitle: z.string().optional(),
  role: z.nativeEnum(ParticipantRole).optional(),
  tags: z.array(z.string()).optional(),
  ticketTypeId: z.string().optional(),
});

export const POST = withErrorHandler(async (request, context) => {
  const eventId = context?.params?.eventId;
  if (!eventId) {
    return createErrorResponse("缺少活动 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  const { session } = await requireEventAccess(eventId);

  const body = await request.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return createErrorResponse(
      parsed.error.issues[0]?.message ?? "参数错误",
      ErrorCode.VALIDATION_ERROR,
      400,
    );
  }

  const tags = normalizeParticipantTags(parsed.data.tags);

  let participantId: string;
  let newlyCreated = false;
  if (parsed.data.phone?.trim()) {
    const merged = await mergeParticipantByPhone(eventId, {
      name: parsed.data.name,
      phone: parsed.data.phone,
      email: parsed.data.email || null,
      company: parsed.data.company,
      jobTitle: parsed.data.jobTitle,
      tags,
      source: ParticipantSource.IMPORT,
      role: parsed.data.role,
    });
    participantId = merged.participant.id;
    newlyCreated = merged.created;
  } else {
    const created = await prisma.participant.create({
      data: {
        eventId,
        name: parsed.data.name,
        email: parsed.data.email || null,
        phone: null,
        company: parsed.data.company || null,
        jobTitle: parsed.data.jobTitle || null,
        role: parsed.data.role ?? ParticipantRole.ATTENDEE,
        systemRole: SystemRole.PARTICIPANT,
        tags,
        source: ParticipantSource.IMPORT,
        badgeQr: generateBadgeQr(eventId),
      },
    });
    participantId = created.id;
    newlyCreated = true;
  }

  if (parsed.data.ticketTypeId) {
    const existingReg = await prisma.participantRegistration.findFirst({
      where: { participantId },
    });
    if (existingReg) {
      await prisma.participantRegistration.update({
        where: { id: existingReg.id },
        data: { ticketTypeId: parsed.data.ticketTypeId, status: "CONFIRMED" },
      });
    } else {
      await prisma.participantRegistration.create({
        data: {
          participantId,
          ticketTypeId: parsed.data.ticketTypeId,
          status: "CONFIRMED",
        },
      });
    }
  }

  if (newlyCreated) {
    void maybeAutoInviteNewParticipants({
      eventId,
      participantIds: [participantId],
      createdBy: session.user.id,
    }).catch((err) => {
      console.error("[participants] auto-invite failed", err);
    });
  }

  const participant = await prisma.participant.findUniqueOrThrow({
    where: { id: participantId },
    include: {
      checkIns: { where: { eventId }, take: 1, orderBy: { checkedInAt: "desc" } },
      registrations: {
        take: 1,
        include: { ticketType: { select: { id: true, name: true } } },
      },
      _count: { select: { leads: true } },
    },
  });

  return createSuccessResponse(serializeParticipantRow(participant, eventId));
});
