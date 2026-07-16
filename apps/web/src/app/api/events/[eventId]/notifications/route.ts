import { ErrorCode } from "@connectiq/types";
import { z } from "zod";
import {
  createErrorResponse,
  createSuccessResponse,
  requireEventAccess,
  withErrorHandler,
} from "@/lib/api-auth";
import {
  createNotificationJob,
  listEnabledTemplates,
} from "@/lib/notification/job-service";
import { seedNotificationTemplates } from "@/lib/notification/seed-templates";
import { isPrismaSchemaDriftError } from "@/lib/prisma-errors";
import { prisma } from "@connectiq/database";

const audienceSchema = z.object({
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
});

async function orgIdForEvent(eventId: string) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { orgId: true },
  });
  return event?.orgId ?? null;
}

/** GET 模板列表；必要时自动种子 */
export const GET = withErrorHandler(async (_request, context) => {
  const eventId = context?.params?.eventId;
  if (!eventId) {
    return createErrorResponse("缺少活动 ID", ErrorCode.VALIDATION_ERROR, 400);
  }
  await requireEventAccess(eventId);

  try {
    let templates = await listEnabledTemplates();
    if (templates.length === 0) {
      await seedNotificationTemplates();
      templates = await listEnabledTemplates();
    } else {
      // 保证自定义通知模板已种子（兼容旧库）
      const hasCustom = templates.some(
        (t) => t.code === "CUSTOM-SMS" || t.code === "CUSTOM-EMAIL",
      );
      if (!hasCustom) {
        await seedNotificationTemplates();
        templates = await listEnabledTemplates();
      }
    }
    return createSuccessResponse({ templates });
  } catch (error) {
    if (isPrismaSchemaDriftError(error)) {
      return createErrorResponse(
        "通知模块数据表尚未就绪，请联系平台管理员执行通知 DDL",
        ErrorCode.INTERNAL_ERROR,
        503,
      );
    }
    throw error;
  }
});

/** POST 创建 draft job */
export const POST = withErrorHandler(async (request, context) => {
  const eventId = context?.params?.eventId;
  if (!eventId) {
    return createErrorResponse("缺少活动 ID", ErrorCode.VALIDATION_ERROR, 400);
  }
  const { session } = await requireEventAccess(eventId);
  const orgId = await orgIdForEvent(eventId);
  if (!orgId) {
    return createErrorResponse("活动不存在", ErrorCode.NOT_FOUND, 404);
  }

  const body = await request.json().catch(() => ({}));
  const schema = z.object({
    template_code: z.string().min(1),
    audience_filter: audienceSchema,
    variable_overrides: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
    scheduled_at: z.string().datetime().optional().nullable(),
  });
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return createErrorResponse("参数错误", ErrorCode.VALIDATION_ERROR, 400);
  }

  const job = await createNotificationJob({
    eventId,
    orgId,
    createdById: session.user.id,
    templateCode: parsed.data.template_code,
    audienceFilter: parsed.data.audience_filter,
    variableOverrides: parsed.data.variable_overrides,
    scheduledAt: parsed.data.scheduled_at
      ? new Date(parsed.data.scheduled_at)
      : null,
  });

  return createSuccessResponse({ job });
});
