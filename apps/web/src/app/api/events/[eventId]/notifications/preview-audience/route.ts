import { ErrorCode } from "@connectiq/types";
import { z } from "zod";
import {
  createErrorResponse,
  createSuccessResponse,
  requireEventAccess,
  withErrorHandler,
} from "@/lib/api-auth";
import { previewAudience } from "@/lib/notification/job-service";
import { prisma } from "@connectiq/database";

const schema = z.object({
  template_code: z.string().min(1),
  audience_filter: z.object({
    type: z.enum([
      "all_attendees",
      "not_activated",
      "activated_no_intent",
      "all_exhibitors",
      "booth",
      "vip",
      "custom",
    ]),
    booth_id: z.string().optional(),
    industry: z.string().optional(),
    title: z.string().optional(),
    ticket_type_id: z.string().optional(),
    source: z.string().optional(),
    confirm_all_attendees_sms: z.boolean().optional(),
  }),
  variable_overrides: z
    .record(z.string(), z.union([z.string(), z.number()]))
    .optional(),
});

export const POST = withErrorHandler(async (request, context) => {
  const eventId = context?.params?.eventId;
  if (!eventId) {
    return createErrorResponse("缺少活动 ID", ErrorCode.VALIDATION_ERROR, 400);
  }
  await requireEventAccess(eventId);
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { orgId: true },
  });
  if (!event) {
    return createErrorResponse("活动不存在", ErrorCode.NOT_FOUND, 404);
  }

  const body = await request.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return createErrorResponse("参数错误", ErrorCode.VALIDATION_ERROR, 400);
  }

  const preview = await previewAudience({
    eventId,
    orgId: event.orgId,
    filter: parsed.data.audience_filter,
    templateCode: parsed.data.template_code,
    variableOverrides: parsed.data.variable_overrides,
  });
  return createSuccessResponse(preview);
});
