import { ErrorCode } from "@connectiq/types";
import { prisma, SignalType } from "@connectiq/database";
import { z } from "zod";
import {
  ApiError,
  createErrorResponse,
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api-auth";
import { requireExhibitorAdmin } from "@/lib/exhibitor/exhibitor-auth";
import { ensureParticipantForUser } from "@/lib/interaction/participant-user";
import { resolveMobileUserId } from "@/lib/mobile-user-id";
import { recordSignal } from "@/lib/signals";

const postSchema = z.object({
  booth_id: z.string().cuid().optional(),
  visitor_user_id: z.string().cuid().optional(),
  intent_level: z.enum(["A", "B", "C"]).optional(),
  intent_tag_ids: z.array(z.string().cuid()).optional(),
  notes: z.string().max(2000).optional(),
  text_note: z.string().max(2000).optional(),
  structured_note: z.string().max(2000).optional(),
  voice_note_url: z.string().url().optional(),
  form_data: z.record(z.unknown()).optional(),
});

function buildLeadNotes(input: z.infer<typeof postSchema>): string | null {
  const payload: Record<string, unknown> = {};
  if (input.form_data && Object.keys(input.form_data).length > 0) {
    payload.form_data = input.form_data;
  }
  if (input.voice_note_url) payload.voice_note_url = input.voice_note_url;
  if (input.text_note?.trim()) payload.text_note = input.text_note.trim();
  if (input.structured_note?.trim()) {
    payload.structured_note = input.structured_note.trim();
  }
  if (input.notes?.trim()) payload.note = input.notes.trim();

  if (Object.keys(payload).length === 0) return null;
  return JSON.stringify(payload);
}

export const POST = withErrorHandler(async (request, context) => {
  const eventId = context?.params?.eventId;
  if (!eventId) {
    return createErrorResponse("缺少活动 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  const operatorUserId = await resolveMobileUserId(request);
  const body = await request.json().catch(() => ({}));
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return createErrorResponse("参数错误", ErrorCode.VALIDATION_ERROR, 400);
  }

  const visitorUserId = parsed.data.visitor_user_id ?? operatorUserId;
  let boothId = parsed.data.booth_id;

  if (visitorUserId !== operatorUserId) {
    const { booth } = await requireExhibitorAdmin(request);
    if (!boothId) boothId = booth.id;
    if (booth.eventId !== eventId) {
      throw new ApiError("展位不属于本活动", ErrorCode.VALIDATION_ERROR, 400);
    }
  } else if (!boothId) {
    try {
      const { booth } = await requireExhibitorAdmin(request);
      boothId = booth.id;
    } catch {
      return createErrorResponse("请指定 booth_id", ErrorCode.VALIDATION_ERROR, 400);
    }
  }

  const booth = await prisma.exhibitorBooth.findFirst({
    where: { id: boothId, eventId },
    select: { id: true },
  });
  if (!booth) {
    return createErrorResponse("展位不存在", ErrorCode.NOT_FOUND, 404);
  }

  const participant = await ensureParticipantForUser(eventId, visitorUserId);
  if (!participant) {
    return createErrorResponse("无法创建参会者记录", ErrorCode.VALIDATION_ERROR, 400);
  }

  const lead = await prisma.lead.create({
    data: {
      boothId: booth.id,
      participantId: participant.id,
      intentGrade: parsed.data.intent_level,
      notes: buildLeadNotes(parsed.data),
      ...(parsed.data.intent_tag_ids?.length
        ? {
            intentTags: {
              create: parsed.data.intent_tag_ids.map((intentTagId) => ({
                intentTagId,
              })),
            },
          }
        : {}),
    },
    include: {
      intentTags: { include: { intentTag: { select: { label: true } } } },
    },
  });

  recordSignal(
    visitorUserId,
    eventId,
    SignalType.BOOTH_LEAD_CAPTURED,
    booth.id,
    "BOOTH",
    { intent_level: parsed.data.intent_level ?? null, operator_user_id: operatorUserId },
  );

  const { scheduleLeadMarketupSync } = await import("@/lib/marketup-sync");
  void scheduleLeadMarketupSync(lead.id, eventId);

  return createSuccessResponse({
    id: lead.id,
    intent_grade: lead.intentGrade,
    created_at: lead.createdAt.toISOString(),
    crm_sync_status: "PENDING",
  });
});
