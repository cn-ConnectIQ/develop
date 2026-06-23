import { ParticipantRole, prisma } from "@connectiq/database";
import { ErrorCode } from "@connectiq/types";
import { z } from "zod";
import { NextResponse } from "next/server";
import {
  createErrorResponse,
  requireEventAccess,
  withErrorHandler,
} from "@/lib/api-auth";
import { participantsToCsv } from "@/lib/participant-notify-service";

const exportSchema = z.object({
  participantIds: z.array(z.string()).optional(),
});

export const POST = withErrorHandler(async (request, context) => {
  const eventId = context?.params?.eventId;
  if (!eventId) {
    return createErrorResponse("缺少活动 ID", ErrorCode.VALIDATION_ERROR, 400);
  }
  await requireEventAccess(eventId);

  const body = await request.json().catch(() => ({}));
  const parsed = exportSchema.safeParse(body);
  if (!parsed.success) {
    return createErrorResponse("参数错误", ErrorCode.VALIDATION_ERROR, 400);
  }

  const participants = await prisma.participant.findMany({
    where: {
      eventId,
      ...(parsed.data.participantIds?.length
        ? { id: { in: parsed.data.participantIds } }
        : {}),
    },
    include: {
      checkIns: { take: 1, orderBy: { checkedInAt: "desc" } },
      registrations: {
        take: 1,
        include: { ticketType: { select: { name: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const rows = participants.map((p) => ({
    name: p.name,
    email: p.email,
    phone: p.phone,
    company: p.company,
    jobTitle: p.jobTitle,
    ticketType: p.registrations[0]?.ticketType?.name ?? null,
    checkedInAt: p.checkIns[0]?.checkedInAt?.toISOString() ?? null,
    inviteStatus: p.inviteStatus,
    role: p.role as ParticipantRole,
  }));

  const csv = participantsToCsv(rows);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="participants-${eventId}.csv"`,
    },
  });
});
