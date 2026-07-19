import {
  ParticipantInviteStatus,
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
import { normalizeInvitePhone } from "@/lib/invite/phone";
import { hashInvitePhone } from "@/lib/invite/token";
import { getParticipantActivationDetail } from "@/lib/participant-activation-detail";
import { serializeParticipantRow } from "@/lib/participant-serialize";
import {
  mergeParticipantTags,
  normalizeParticipantTags,
} from "@/lib/participant-tags";

export const GET = withErrorHandler(async (_request, context) => {
  const eventId = context?.params?.eventId;
  const participantId = context?.params?.participantId;
  if (!eventId || !participantId) {
    return createErrorResponse("参数缺失", ErrorCode.VALIDATION_ERROR, 400);
  }

  await requireEventAccess(eventId);

  const detail = await getParticipantActivationDetail(eventId, participantId);
  if (!detail) {
    return createErrorResponse("参会者不存在", ErrorCode.NOT_FOUND, 404);
  }

  return createSuccessResponse(detail);
});

const patchSchema = z.object({
  name: z.string().optional(),
  email: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  company: z.string().nullable().optional(),
  jobTitle: z.string().nullable().optional(),
  role: z.nativeEnum(ParticipantRole).optional(),
  systemRole: z.nativeEnum(SystemRole).optional(),
  boothId: z.string().nullable().optional(),
  isBoothOwner: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
  addTags: z.array(z.string()).optional(),
  ticketTypeId: z.string().nullable().optional(),
  checkIn: z.boolean().optional(),
});

function phonesEqual(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  const na = a ? normalizeInvitePhone(a) ?? a.replace(/\D/g, "") : "";
  const nb = b ? normalizeInvitePhone(b) ?? b.replace(/\D/g, "") : "";
  return na === nb;
}

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

  let nextPhone: string | null | undefined = undefined;
  if (parsed.data.phone !== undefined) {
    const raw = parsed.data.phone?.trim() || null;
    if (raw) {
      const normalized = normalizeInvitePhone(raw);
      if (!normalized) {
        return createErrorResponse(
          "请输入有效的中国大陆手机号",
          ErrorCode.VALIDATION_ERROR,
          400,
        );
      }
      nextPhone = normalized;
    } else {
      nextPhone = null;
    }

    if (
      participant.inviteStatus === ParticipantInviteStatus.ACTIVATED &&
      !phonesEqual(participant.phone, nextPhone)
    ) {
      return createErrorResponse(
        "已激活参会者不可修改手机号",
        ErrorCode.VALIDATION_ERROR,
        400,
      );
    }
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

  const phoneChanging =
    nextPhone !== undefined && !phonesEqual(participant.phone, nextPhone);

  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.participant.update({
      where: { id: participantId },
      data: {
        name: parsed.data.name,
        email:
          parsed.data.email === undefined
            ? undefined
            : parsed.data.email?.trim() || null,
        phone:
          participant.inviteStatus === ParticipantInviteStatus.ACTIVATED
            ? undefined
            : nextPhone,
        company:
          parsed.data.company === undefined
            ? undefined
            : parsed.data.company?.trim() || null,
        jobTitle:
          parsed.data.jobTitle === undefined
            ? undefined
            : parsed.data.jobTitle?.trim() || null,
        role: parsed.data.role,
        systemRole: parsed.data.systemRole,
        boothId: parsed.data.boothId,
        isBoothOwner: parsed.data.isBoothOwner,
        tags: nextTags,
      },
      include: {
        checkIns: {
          where: { eventId },
          take: 1,
          orderBy: { checkedInAt: "desc" },
        },
        registrations: {
          take: 1,
          include: { ticketType: { select: { id: true, name: true } } },
        },
        _count: { select: { leads: true } },
      },
    });

    if (phoneChanging && nextPhone) {
      const phoneHash = hashInvitePhone(nextPhone);
      await tx.inviteRecord.updateMany({
        where: {
          participantId,
          campaign: { eventId },
        },
        data: {
          destination: nextPhone,
          phoneHash,
        },
      });
      await tx.inviteEntry.updateMany({
        where: { eventId, participantId },
        data: { phone: nextPhone },
      });
    }

    return row;
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
