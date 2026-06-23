import { prisma } from "@connectiq/database";
import { ErrorCode } from "@connectiq/types";
import { z } from "zod";
import {
  createErrorResponse,
  createSuccessResponse,
  requireEventAccess,
  withErrorHandler,
} from "@/lib/api-auth";
import { maybeTriggerReferralScanOnCheckin } from "@/lib/ai/referral-scanner";

const batchSchema = z.object({
  action: z.enum(["check_in", "update_ticket", "delete"]),
  participantIds: z.array(z.string()).min(1),
  ticketTypeId: z.string().nullable().optional(),
});

export const POST = withErrorHandler(async (request, context) => {
  const eventId = context?.params?.eventId;
  if (!eventId) {
    return createErrorResponse("缺少活动 ID", ErrorCode.VALIDATION_ERROR, 400);
  }
  await requireEventAccess(eventId);

  const body = await request.json();
  const parsed = batchSchema.safeParse(body);
  if (!parsed.success) {
    return createErrorResponse("参数错误", ErrorCode.VALIDATION_ERROR, 400);
  }

  const { action, participantIds, ticketTypeId } = parsed.data;
  let affected = 0;

  if (action === "delete") {
    const result = await prisma.participant.deleteMany({
      where: { eventId, id: { in: participantIds } },
    });
    return createSuccessResponse({ affected: result.count });
  }

  const participants = await prisma.participant.findMany({
    where: { eventId, id: { in: participantIds } },
    include: { registrations: { take: 1 } },
  });

  for (const p of participants) {
    if (action === "check_in") {
      const existing = await prisma.checkIn.findFirst({
        where: { eventId, participantId: p.id },
      });
      if (!existing) {
        await prisma.checkIn.create({
          data: { eventId, participantId: p.id, method: "manual" },
        });
        affected += 1;
      }
    } else if (action === "update_ticket") {
      const reg = p.registrations[0];
      if (reg) {
        await prisma.participantRegistration.update({
          where: { id: reg.id },
          data: { ticketTypeId: ticketTypeId ?? null },
        });
      } else if (ticketTypeId) {
        await prisma.participantRegistration.create({
          data: {
            participantId: p.id,
            ticketTypeId,
            status: "CONFIRMED",
          },
        });
      }
      affected += 1;
    }
  }

  if (action === "check_in" && affected > 0) {
    void maybeTriggerReferralScanOnCheckin(eventId).catch(() => {});
  }

  return createSuccessResponse({ affected });
});
