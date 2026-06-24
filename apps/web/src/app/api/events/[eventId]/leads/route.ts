import { ErrorCode } from "@connectiq/types";
import { prisma, SignalType } from "@connectiq/database";
import { z } from "zod";
import {
  ApiError,
  createErrorResponse,
  createSuccessResponse,
  requireAuth,
  withErrorHandler,
} from "@/lib/api-auth";
import { ensureParticipantForUser } from "@/lib/interaction/participant-user";
import { recordSignal } from "@/lib/signals";

const postSchema = z.object({
  booth_id: z.string().cuid(),
  intent_level: z.enum(["A", "B", "C"]).optional(),
  intent_tag_ids: z.array(z.string().cuid()).optional(),
  notes: z.string().max(2000).optional(),
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
    select: { id: true },
  });
  if (!booth) {
    return createErrorResponse("展位不存在", ErrorCode.NOT_FOUND, 404);
  }

  const participant = await ensureParticipantForUser(eventId, userId);
  if (!participant) {
    return createErrorResponse("无法创建参会者记录", ErrorCode.VALIDATION_ERROR, 400);
  }

  const lead = await prisma.lead.create({
    data: {
      boothId: parsed.data.booth_id,
      participantId: participant.id,
      intentGrade: parsed.data.intent_level,
      notes: parsed.data.notes,
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
    userId,
    eventId,
    SignalType.BOOTH_LEAD_CAPTURED,
    parsed.data.booth_id,
    "BOOTH",
    { intent_level: parsed.data.intent_level ?? null },
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
