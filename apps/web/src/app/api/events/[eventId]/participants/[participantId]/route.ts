import {
  ParticipantRole,
  SystemRole,
  prisma,
} from "@connectiq/database";
import { ErrorCode } from "@connectiq/types";
import { z } from "zod";
import {
  createErrorResponse,
  createSuccessResponse,
  requireEventAccess,
  withErrorHandler,
} from "@/lib/api-auth";
import { maybeTriggerReferralScanOnCheckin } from "@/lib/ai/referral-scanner";
import { serializeParticipantRow } from "@/lib/participant-serialize";
import {
  mergeParticipantTags,
  normalizeParticipantTags,
} from "@/lib/participant-tags";

const patchSchema = z.object({
  name: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  company: z.string().optional(),
  jobTitle: z.string().optional(),
  role: z.nativeEnum(ParticipantRole).optional(),
  systemRole: z.nativeEnum(SystemRole).optional(),
  boothId: z.string().nullable().optional(),
  isBoothOwner: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
  addTags: z.array(z.string()).optional(),
  ticketTypeId: z.string().nullable().optional(),
  checkIn: z.boolean().optional(),
});

export const PATCH = withErrorHandler(async (request, context) => {
  const eventId = context?.params?.eventId;
  const participantId = context?.params?.participantId;
  if (!eventId || !participantId) {
    return createErrorResponse("参数缺失", ErrorCode.VALIDATION_ERROR, 400);
  }

  await requireEventAccess(eventId);

  const body = await request.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return createErrorResponse("参数错误", ErrorCode.VALIDATION_ERROR, 400);
  }

  const participant = await prisma.participant.findFirst({
    where: { id: participantId, eventId },
    include: { registrations: { take: 1 } },
  });
  if (!participant) {
    return createErrorResponse("参会者不存在", ErrorCode.NOT_FOUND, 404);
  }

  if (parsed.data.checkIn) {
    const existing = await prisma.checkIn.findFirst({
      where: { eventId, participantId },
    });
    if (!existing) {
      await prisma.checkIn.create({
        data: { eventId, participantId, method: "manual" },
      });
      void maybeTriggerReferralScanOnCheckin(eventId).catch(() => {});
    }
  }

  if (parsed.data.ticketTypeId !== undefined) {
    const registration = participant.registrations[0];
    if (registration) {
      await prisma.participantRegistration.update({
        where: { id: registration.id },
        data: { ticketTypeId: parsed.data.ticketTypeId },
      });
    } else if (parsed.data.ticketTypeId) {
      await prisma.participantRegistration.create({
        data: {
          participantId,
          ticketTypeId: parsed.data.ticketTypeId,
          status: "CONFIRMED",
        },
      });
    }
  }

  let nextTags = participant.tags;
  if (parsed.data.tags !== undefined) {
    nextTags = normalizeParticipantTags(parsed.data.tags);
  } else if (parsed.data.addTags?.length) {
    nextTags = mergeParticipantTags(participant.tags, parsed.data.addTags);
  }

  const updated = await prisma.participant.update({
    where: { id: participantId },
    data: {
      name: parsed.data.name,
      email: parsed.data.email,
      phone: parsed.data.phone,
      company: parsed.data.company,
      jobTitle: parsed.data.jobTitle,
      role: parsed.data.role,
      systemRole: parsed.data.systemRole,
      boothId: parsed.data.boothId,
      isBoothOwner: parsed.data.isBoothOwner,
      tags: nextTags,
    },
    include: {
      checkIns: { where: { eventId }, take: 1, orderBy: { checkedInAt: "desc" } },
      registrations: {
        take: 1,
        include: { ticketType: { select: { id: true, name: true } } },
      },
      _count: { select: { leads: true } },
    },
  });

  return createSuccessResponse(serializeParticipantRow(updated, eventId));
});

export const DELETE = withErrorHandler(async (_request, context) => {
  const eventId = context?.params?.eventId;
  const participantId = context?.params?.participantId;
  if (!eventId || !participantId) {
    return createErrorResponse("参数缺失", ErrorCode.VALIDATION_ERROR, 400);
  }

  await requireEventAccess(eventId);

  const participant = await prisma.participant.findFirst({
    where: { id: participantId, eventId },
  });
  if (!participant) {
    return createErrorResponse("参会者不存在", ErrorCode.NOT_FOUND, 404);
  }

  await prisma.participant.delete({ where: { id: participantId } });

  return createSuccessResponse({ deleted: true });
});
