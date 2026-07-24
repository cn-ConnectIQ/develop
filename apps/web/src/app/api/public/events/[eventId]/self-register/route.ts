import {
  EventStatus,
  ParticipantRole,
  ParticipantSource,
  prisma,
} from "@connectiq/database";
import { ErrorCode } from "@connectiq/types";
import { z } from "zod";
import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api-auth";
import { ENABLE_INTERNAL_SELF_REGISTER } from "@/lib/internal-self-register";
import { mergeParticipantByPhone } from "@/lib/participant-merge";

const bodySchema = z.object({
  name: z.string().trim().min(1, "请输入姓名").max(80),
  phone: z
    .string()
    .trim()
    .min(1, "请输入手机号")
    .regex(/^1\d{10}$/, "请输入 11 位手机号"),
  company: z.string().trim().max(120).optional(),
  jobTitle: z.string().trim().max(80).optional(),
});

/**
 * 内部测试：公开自助报名（无需登录）。
 * 仅允许 PUBLISHED / LIVE 活动。
 */
export const POST = withErrorHandler(async (request, context) => {
  if (!ENABLE_INTERNAL_SELF_REGISTER) {
    return createErrorResponse("报名入口已关闭", ErrorCode.FORBIDDEN, 403);
  }

  const eventId = context?.params?.eventId;
  if (!eventId) {
    return createErrorResponse("缺少活动 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, name: true, status: true },
  });
  if (!event) {
    return createErrorResponse("活动不存在", ErrorCode.NOT_FOUND, 404);
  }
  if (
    event.status !== EventStatus.PUBLISHED &&
    event.status !== EventStatus.LIVE
  ) {
    return createErrorResponse(
      "活动未开放报名",
      ErrorCode.FORBIDDEN,
      403,
    );
  }

  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return createErrorResponse(
      parsed.error.issues[0]?.message ?? "参数错误",
      ErrorCode.VALIDATION_ERROR,
      400,
    );
  }

  const { name, phone, company, jobTitle } = parsed.data;
  const merged = await mergeParticipantByPhone(eventId, {
    name,
    phone,
    company: company || null,
    jobTitle: jobTitle || null,
    source: ParticipantSource.SELF_REGISTER,
    role: ParticipantRole.ATTENDEE,
  });

  return createSuccessResponse({
    participantId: merged.participant.id,
    created: merged.created,
    eventName: event.name,
  });
});
